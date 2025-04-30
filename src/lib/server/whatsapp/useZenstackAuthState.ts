import { getEnhancedPrisma } from '$lib/server/prisma';
import pkg from '@whiskeysockets/baileys';
const { proto } = pkg;
import types from '@whiskeysockets/baileys/lib/Types';
import { initAuthCreds } from '@whiskeysockets/baileys/lib/Utils';
import { BufferJSON } from '@whiskeysockets/baileys/lib/Utils';
import { logger } from '$lib/server/logger';

const prisma = getEnhancedPrisma({
  id: '',
  systemRole: 'ADMIN',
  rolesString: 'ADMIN'
});

/**
 * Writes data to the database.
 *
 * - For "creds.json": store as JSON.
 * - For keys starting with "app-state-sync-key": convert the plain object 
 *   to a protocol message, encode to binary, and then store as base64.
 * - For other keys: if the value is a Uint8Array or Buffer, store as base64.
 *   Otherwise, fallback to JSON.stringify.
 */
const writeData = async (clientId: string, keyId: string, value: any): Promise<void> => {
  let dataString: string;
  try {
    // Add logging for session data
    if (keyId.startsWith('session-')) {
      logger.debug(`Writing session data for ${keyId.split('-')[1]}`);
    }
    
    if (keyId === 'creds.json') {
      dataString = JSON.stringify(value, BufferJSON.replacer);
    } else if (keyId.startsWith('app-state-sync-key')) {
      // Convert the plain object to a protocol message and encode it to binary.
      const message = proto.Message.AppStateSyncKeyData.fromObject(value);
      const binary = proto.Message.AppStateSyncKeyData.encode(message).finish();
      dataString = Buffer.from(binary).toString('base64');
    } else if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      dataString = Buffer.from(value).toString('base64');
    } else if (typeof value === 'object' && value !== null) {
      // Fallback: if non-binary object, store as JSON.
      dataString = JSON.stringify(value, BufferJSON.replacer);
    } else {
      dataString = JSON.stringify(value);
    }

    await prisma.whatsAppAuthData.upsert({
      where: { clientId_keyId: { clientId, keyId } },
      update: {
        data: dataString,
        updatedAt: new Date()
      },
      create: {
        clientId,
        keyId,
        type: keyId === 'creds.json' ? 'creds' : keyId.split('-')[0],
        data: dataString
      }
    });
  } catch (err) {
    console.error(`❌ Error writing data for key ${keyId}:`, err);
    throw err;
  }
};

/**
 * Reads data from the database.
 *
 * - For "creds.json": parse the stored JSON.
 * - For keys starting with "app-state-sync-key": decode base64 to Uint8Array.
 * - For other keys: decode base64 to a Uint8Array.
 */
const readData = async (clientId: string, keyId: string): Promise<any> => {
  const record = await prisma.whatsAppAuthData.findUnique({
    where: { clientId_keyId: { clientId, keyId } }
  });
  
  // Add logging for session data
  if (keyId.startsWith('session-')) {
    const sessionId = keyId.split('-')[1];
    if (!record) {
      logger.debug(`No session found for ${sessionId}`);
    } else {
      logger.debug(`Found session data for ${sessionId}`);
    }
  }
  
  if (!record) return null;
  
  try {
    if (keyId === 'creds.json') {
      return JSON.parse(record.data, BufferJSON.reviver);
    }
    if (keyId.startsWith('app-state-sync-key')) {
      // For app-state-sync-key, the stored value is base64 of encoded binary.
      const buf = Buffer.from(record.data, 'base64');
      return new Uint8Array(buf);
    }
    // Special handling for session data - try to parse as JSON first
    if (keyId.startsWith('session-')) {
      try {
        return JSON.parse(record.data, BufferJSON.reviver);
      } catch (e) {
        // If JSON parsing fails, fall back to binary handling
        const buf = Buffer.from(record.data, 'base64');
        return new Uint8Array(buf);
      }
    }
    // For other keys, decode base64 into Uint8Array.
    const buf = Buffer.from(record.data, 'base64');
    return new Uint8Array(buf);
  } catch (err) {
    logger.warn(`Failed to read data for key ${keyId}:`, err);
    return null;
  }
};

/**
 * Removes data from the database for a given key.
 */
const removeData = async (clientId: string, keyId: string): Promise<void> => {
  await prisma.whatsAppAuthData.deleteMany({
    where: { clientId, keyId }
  });
};

export const useZenstackAuthState = async (
  clientId: string
): Promise<{ state: types.AuthenticationState; saveCreds: () => Promise<void> }> => {
  // Retrieve or initialize credentials.
  const creds: types.AuthenticationCreds =
    (await readData(clientId, 'creds.json')) ?? initAuthCreds();
    
  logger.info(`Loaded auth state for client ${clientId}`);

  return {
    state: {
      creds,
      keys: {
        get: async (
          type: string,
          ids: string[]
        ): Promise<{ [id: string]: types.SignalDataTypeMap[typeof type] }> => {
          const result: { [id: string]: any } = {};
          
          // Add debug logging for session fetches
          if (type === 'session') {
            logger.debug(`Fetching ${ids.length} sessions for client ${clientId}`);
          }
          
          await Promise.all(
            ids.map(async id => {
              // Build the key name as in the original design.
              const keyId = `${type}-${id}.json`;
              let value = await readData(clientId, keyId);
              
              // For app-state-sync-key, convert back to protocol message
              if (type === 'app-state-sync-key' && value) {
                const buf = Buffer.from(value);
                const message = proto.Message.AppStateSyncKeyData.decode(buf);
                result[id] = message;
              } else {
                result[id] = value;
              }
            })
          );
          return result;
        },
        set: async (data: { [category: string]: { [id: string]: any } }) => {
          const tasks: Promise<void>[] = [];
          
          // Add debug logging for session storage
          if (data['session']) {
            const sessionIds = Object.keys(data['session']);
            if (sessionIds.length > 0) {
              logger.debug(`Storing ${sessionIds.length} sessions for client ${clientId}`);
              // Log the specific session IDs being stored
              logger.debug(`Session IDs: ${sessionIds.join(', ')}`);
            }
          }
          
          for (const category in data) {
            for (const id in data[category]) {
              const keyId = `${category}-${id}.json`;
              const value = data[category][id];
              if (value) {
                tasks.push(writeData(clientId, keyId, value));
              } else {
                tasks.push(removeData(clientId, keyId));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: async (): Promise<void> => {
      logger.debug(`Saving credentials for client ${clientId}`);
      await writeData(clientId, 'creds.json', creds);
    }
  };
};
