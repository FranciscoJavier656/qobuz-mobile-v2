import { createHash } from 'crypto';

export const hashMD5 = (data: string): string => {
    return createHash('md5').update(data).digest('hex');
};

export const base64Encode = (data: string): string => {
    return Buffer.from(data).toString('base64');
};

export const base64Decode = (data: string): string => {
    return Buffer.from(data, 'base64').toString('utf-8');
};