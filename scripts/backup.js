const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);
const logger = require('../src/utils/logger');

class DatabaseBackup {
    constructor() {
        this.backupDir = path.join(__dirname, '../backups');
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.backupPath = path.join(this.backupDir, `backup-${this.timestamp}`);
        
        // Ensure backup directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }
    
    async createBackup() {
        try {
            logger.info('🔄 Starting database backup...');
            
            // Connect to MongoDB
            await mongoose.connect(process.env.MONGODB_URI);
            
            // Get list of collections
            const collections = await mongoose.connection.db.listCollections().toArray();
            
            const backupData = {};
            
            // Backup each collection
            for (const collection of collections) {
                const collectionName = collection.name;
                logger.info(`📦 Backing up collection: ${collectionName}`);
                
                const data = await mongoose.connection.db.collection(collectionName).find({}).toArray();
                backupData[collectionName] = data;
            }
            
            // Save backup to file
            const backupFile = `${this.backupPath}.json`;
            fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
            
            // Create compressed backup
            await this.compressBackup(backupFile);
            
            // Clean up uncompressed file
            fs.unlinkSync(backupFile);
            
            // Clean up old backups (keep last 7 days)
            await this.cleanupOldBackups();
            
            logger.info(`✅ Backup completed: ${this.backupPath}.tar.gz`);
            return `${this.backupPath}.tar.gz`;
            
        } catch (error) {
            logger.error('❌ Backup failed:', error);
            throw error;
        } finally {
            await mongoose.connection.close();
        }
    }
    
    async compressBackup(filePath) {
        try {
            const command = `tar -czf "${filePath}.tar.gz" -C "${path.dirname(filePath)}" "${path.basename(filePath)}"`;
            await execAsync(command);
            logger.info('✅ Backup compressed successfully');
        } catch (error) {
            logger.error('❌ Backup compression failed:', error);
            throw error;
        }
    }
    
    async cleanupOldBackups() {
        try {
            const files = fs.readdirSync(this.backupDir);
            const backupFiles = files.filter(file => file.endsWith('.tar.gz'));
            
            if (backupFiles.length > 7) { // Keep last 7 backups
                backupFiles.sort(); // Sort by name (which includes timestamp)
                const filesToDelete = backupFiles.slice(0, backupFiles.length - 7);
                
                for (const file of filesToDelete) {
                    fs.unlinkSync(path.join(this.backupDir, file));
                    logger.info(`🗑️  Deleted old backup: ${file}`);
                }
            }
        } catch (error) {
            logger.error('❌ Cleanup failed:', error);
        }
    }
    
    async restoreBackup(backupFile) {
        try {
            if (!backupFile) {
                // Get latest backup
                const files = fs.readdirSync(this.backupDir);
                const backupFiles = files.filter(file => file.endsWith('.tar.gz'));
                if (backupFiles.length === 0) {
                    throw new Error('No backup files found');
                }
                backupFiles.sort();
                backupFile = backupFiles[backupFiles.length - 1];
            }
            
            const backupPath = path.join(this.backupDir, backupFile);
            
            logger.info(`🔄 Restoring from backup: ${backupFile}`);
            
            // Extract backup
            const extractDir = path.join(this.backupDir, 'temp-restore');
            if (fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true });
            }
            fs.mkdirSync(extractDir, { recursive: true });
            
            await execAsync(`tar -xzf "${backupPath}" -C "${extractDir}"`);
            
            // Find extracted JSON file
            const extractedFiles = fs.readdirSync(extractDir);
            const jsonFile = extractedFiles.find(file => file.endsWith('.json'));
            
            if (!jsonFile) {
                throw new Error('No JSON file found in backup');
            }
            
            const backupData = JSON.parse(fs.readFileSync(path.join(extractDir, jsonFile), 'utf8'));
            
            // Connect to MongoDB
            await mongoose.connect(process.env.MONGODB_URI);
            
            // Restore each collection
            for (const [collectionName, data] of Object.entries(backupData)) {
                logger.info(`📦 Restoring collection: ${collectionName}`);
                
                // Clear existing data
                await mongoose.connection.db.collection(collectionName).deleteMany({});
                
                // Insert backup data
                if (data.length > 0) {
                    await mongoose.connection.db.collection(collectionName).insertMany(data);
                }
            }
            
            // Clean up
            fs.rmSync(extractDir, { recursive: true });
            
            logger.info('✅ Database restored successfully');
            
        } catch (error) {
            logger.error('❌ Restore failed:', error);
            throw error;
        } finally {
            await mongoose.connection.close();
        }
    }
    
    async listBackups() {
        try {
            const files = fs.readdirSync(this.backupDir);
            const backupFiles = files.filter(file => file.endsWith('.tar.gz'));
            
            backupFiles.sort().reverse(); // Sort by newest first
            
            return backupFiles.map(file => {
                const stats = fs.statSync(path.join(this.backupDir, file));
                return {
                    filename: file,
                    size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                    created: stats.birthtime
                };
            });
        } catch (error) {
            logger.error('❌ List backups failed:', error);
            return [];
        }
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const backup = new DatabaseBackup();
    
    switch (command) {
        case 'create':
            await backup.createBackup();
            break;
            
        case 'restore':
            const backupFile = args[1];
            await backup.restoreBackup(backupFile);
            break;
            
        case 'list':
            const backups = await backup.listBackups();
            console.log('📂 Available backups:');
            backups.forEach((b, i) => {
                console.log(`${i + 1}. ${b.filename} (${b.size}) - ${b.created}`);
            });
            break;
            
        case 'cleanup':
            await backup.cleanupOldBackups();
            break;
            
        default:
            console.log('Usage: node backup.js <command>');
            console.log('Commands:');
            console.log('  create     - Create a new backup');
            console.log('  restore [file] - Restore from backup (default: latest)');
            console.log('  list       - List available backups');
            console.log('  cleanup    - Cleanup old backups');
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DatabaseBackup;
