import bcrypt from 'bcrypt';
import { SECURITY } from '../constants/index.js';

export const hashPassword = (password) => bcrypt.hash(password, SECURITY.BCRYPT_SALT_ROUNDS);

export const comparePassword = (password, hash) => bcrypt.compare(password, hash);
