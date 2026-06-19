import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { getCliDatabaseConfig } from './database/database.config';

config();

export default new DataSource(getCliDatabaseConfig());
