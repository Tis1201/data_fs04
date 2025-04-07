import { PrismaClient } from '@prisma/client'
import { proto } from '@whiskeysockets/baileys'
import { AuthenticationState, AuthenticationCreds, SignalDataTypeMap } from '@whiskeysockets/baileys/lib/Types'
import { initAuthCreds } from '@whiskeysockets/baileys/lib/Utils'

const prisma = new PrismaClient()

export const useZenstackAuthState = async (
    clientId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {
    const readData = async (keyId: string) => {
        const record = await prisma.whatsAppAuthData.findUnique({
            where: { clientId_keyId: { clientId, keyId } }
        })
        if (!record) return null
        try {
            return JSON.parse(record.data)
        } catch (err) {
            console.warn(`⚠️ Failed to parse JSON for key ${keyId}:`, err)
            return null
        }
    }

    const writeData = async (keyId: string, value: any) => {
        await prisma.whatsAppAuthData.upsert({
            where: { clientId_keyId: { clientId, keyId } },
            update: {
                data: JSON.stringify(value),
                updatedAt: new Date()
            },
            create: {
                clientId,
                keyId,
                type: keyId === 'creds.json' ? 'creds' : keyId.split('-')[0],
                data: JSON.stringify(value)
            }
        })
    }

    const removeData = async (keyId: string) => {
        await prisma.whatsAppAuthData.deleteMany({
            where: { clientId, keyId }
        })
    }

    const creds: AuthenticationCreds = (await readData('creds.json')) ?? initAuthCreds()

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const result: { [id: string]: SignalDataTypeMap[typeof type] } = {}
                    await Promise.all(
                        ids.map(async id => {
                            const keyId = `${type}-${id}.json`
                            let value = await readData(keyId)
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value)
                            }
                            result[id] = value
                        })
                    )
                    return result
                },
                set: async data => {
                    const tasks: Promise<void>[] = []
                    for (const category in data) {
                        for (const id in data[category]) {
                            const keyId = `${category}-${id}.json`
                            const value = data[category][id]
                            tasks.push(value ? writeData(keyId, value) : removeData(keyId))
                        }
                    }
                    await Promise.all(tasks)
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds.json', creds)
        }
    }
}
