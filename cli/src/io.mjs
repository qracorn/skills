import {copyFile, link, open, unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dirname, join} from 'node:path';

export class InputError extends Error {}

export async function boundedFile(path, limit, label) {
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
    const stats = await file.stat();
    if (!stats.isFile() || stats.size === 0 || stats.size > limit) throw new Error();
    const bytes = Buffer.alloc(stats.size);
    let offset=0;
    while (offset<bytes.length) {
      const {bytesRead}=await file.read(bytes,offset,bytes.length-offset,offset);
      if (!bytesRead) throw new Error();
      offset+=bytesRead;
    }
    if ((await file.stat()).size!==bytes.length) throw new Error();
    return bytes;
  } catch {
    throw new InputError('Could not read the ' + label + ' within its size limit.');
  } finally {
    await file?.close();
  }
}

export async function readJson(filename, limit, label) {
  const bytes = await boundedFile(filename, limit, label);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new InputError('The ' + label + ' must contain valid UTF-8 JSON.');
  }
}


const maxInputBytes=64*1024;

export async function readUtf8(filename) {
  let bytes;
  if (filename==='-') {
    const chunks=[];
    let total=0;
    for await (const chunk of process.stdin) {
      total+=chunk.length;
      if (total>maxInputBytes) throw new InputError('UTF-8 input exceeds 64 KiB.');
      chunks.push(chunk);
    }
    bytes=Buffer.concat(chunks);
  } else {
    bytes=await boundedFile(filename,maxInputBytes,'UTF-8 input file');
  }
  try {return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}
  catch {throw new InputError('The input must contain valid UTF-8.');}
}

export async function writeNew(filename, bytes) {
  const temp=join(dirname(filename),'.qracorn-'+randomUUID()+'.tmp');
  let created=false;
  try {
    const file=await open(temp,'wx',0o600);
    created=true;
    try {await file.writeFile(bytes);} finally {await file.close();}
    try {await link(temp,filename);}
    catch (error) {
      // FAT and some network volumes do not support hard links.
      if (!['EPERM','ENOTSUP','EOPNOTSUPP','ENOSYS'].includes(error.code)) throw error;
      await copyFile(temp,filename,constants.COPYFILE_EXCL);
    }
  } catch (error) {
    if (error.code==='EEXIST') throw new InputError('The output already exists. Choose a new filename.');
    throw new InputError('The output could not be written. Check the directory and file permissions.');
  } finally {
    if (created) await unlink(temp);
  }
}
