import axios from "axios";
import { vcr } from "@vonage/vcr-sdk";


const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const subdomain = process.env.SUBDOMAIN;

export async function getAccessToken() {

    const instanceState = vcr.getInstanceState();
    const storedExpiryTime = await instanceState.get("storedExpiryTime");
    const storedAccessToken = await instanceState.get("storedAccessToken");
    const currentTimeSec = Math.floor(Date.now() / 1000);

    if (currentTimeSec < storedExpiryTime && (typeof storedAccessToken !== 'undefined' || storedAccessToken !== null)) {
        return storedAccessToken;
    }
    else {

        const authUrl = `https://${subdomain}.auth.marketingcloudapis.com/v2/token`;

        try {
            const response = await axios.post(authUrl, {
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "client_credentials",
            });

            const accessToken = response.data.access_token;
            const expires_in = response.data.expires_in;
            console.log("new Access Token generated after 20 min expiry");
            await instanceState.set("storedExpiryTime", currentTimeSec + expires_in);
            await instanceState.set("storedAccessToken", accessToken);
            return accessToken;
        } catch (error) {
            console.error(
                "Error fetching access token:",
                error.response ? error.response.data : error.message
            );
        }
    }
}

// Upsert rows in a Data Extension
export async function upsertDataExtensionRows(accessToken, externalKey, data) {
    const upsertURL = `https://${subdomain}.rest.marketingcloudapis.com/data/v1/async/dataextensions/key:${externalKey}/rows`;

    try {
        const response = await axios.put(upsertURL, data, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        console.log("Upsert response:", response.data);
        return response.data;
    } catch (error) {
        console.error(
            "Error upserting data extension rows:",
            error.response.data.resultMessages
        );
    }
}
