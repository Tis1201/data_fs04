import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'Not authorized' }), { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { action, phoneNumber, accountId } = body;

        // Forward the request to the WebSocket server
        if (locals.wss) {
            // Broadcast to all clients
            locals.wss.clients.forEach(client => {
                if (client.readyState === 1) { // OPEN
                    client.send(JSON.stringify({
                        type: 'whatsapp',
                        action: action === 'requestQR' ? 'qrCode' : 'pairingCode',
                        data: {
                            // Mock data for testing - in production this would come from Baileys
                            qrCode: action === 'requestQR' ? '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' : null,
                            code: action === 'requestPairingCode' ? '1234-5678' : null,
                            phoneNumber,
                            accountId
                        }
                    }));
                }
            });
        }

        return json({ success: true });
    } catch (error) {
        console.error('Error processing WhatsApp authentication request:', error);
        return json({ error: 'Failed to process request' }, { status: 500 });
    }
};
