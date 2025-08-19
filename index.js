import { Vonage } from "@vonage/server-sdk";
import express from 'express';
import { parsePhoneNumber } from 'libphonenumber-js';
import { getAccessToken, upsertDataExtensionRows } from "./marketing-apis.js";
import { returnCSVContentFromAssets } from "./language-pack.js";
import axios from "axios";

const app = express();
const port = process.env.VCR_PORT;

const vonage = new Vonage(
    {
        applicationId: process.env.API_APPLICATION_ID,
        privateKey: process.env.PRIVATE_KEY
    }
);

app.use(express.json());
app.use(express.static('public'));

app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
});

app.get('/_/check', async (req, res) => {
    res.sendStatus(200);
});

app.get('/_/metrics', async (req, res) => {
    res.sendStatus(200);
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
});

/**
 * GET /language?format=text : returns raw CSV as text (default)
 * GET /language?format=json : returns CSV parsed into JSON
 * 
 * The file is replaced if the name in the Assets folder is different than the current one.
 */
app.get('/language', async (req, res) => {
    await returnCSVContentFromAssets(req, res)
});
app.get('/language/:phone', async (req, res) => {
    await returnCSVContentFromAssets(req, res)
});

// endpoint to compare time
app.post("/comparetime", async (req, res) => {
    console.log("status:", req.body);
    if (typeof req.body.date !== 'undefined') {
        let today = new Date();
        let dateString = today.toLocaleDateString();

        return res.json({ status: "valid" });
    }
    else {
        return res.json({ status: "missing date" });
    }
});

app.post("/p4fVCqqbXrYu9RTOl9ZBdq/consent", async (req, res) => {
    console.log("status:", req.body);
    let items = [];
    const doubleformatEnable = process.env.DOUBLE_FORMAT_ENABLE;
    if (typeof req.body.phonenumber === 'undefined' || typeof req.body.optinstatus === 'undefined' || isNaN(req.body.phonenumber)) {
        console.log("Consent input Error - phone number:", req.body.phonenumber);
        return res.json({ status: "error", message: "missing phonenumber or optinstatus" });
    }
    else {

        const externalKey = process.env.SFMC_EXTERNAL_KEY_CONSENT;
        let today = new Date();
        let dateString = today.toLocaleString("en-US", {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false, // Use 24-hour format
        });


        if ((typeof doubleformatEnable !== 'undefined' || doubleformatEnable !== null) && doubleformatEnable == "true") {
            const numberFormated = parsePhoneNumber("+" + req.body.phonenumber.toString())
            if (numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, "") != req.body.phonenumber) {
                console.log("double needed", numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, ""));
                items.push(
                    {
                        phoneNumber: numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, ""),
                        optinstatus: req.body.optinstatus,
                        timestamp: dateString,
                    });
            }
        }

        items.push(
            {
                phoneNumber: req.body.phonenumber,
                optinstatus: req.body.optinstatus,
                timestamp: dateString,
            });


        const dataToUpsert = { items: items };
        console.log(dataToUpsert);

        try {
            const accessToken = await getAccessToken();
            await upsertDataExtensionRows(accessToken, externalKey, dataToUpsert);
            return res.json({ status: "success" });
        } catch (error) {
            console.error("Error in Upsert:", error);
            return res.json({ status: "error", message: "error in upsert to SFMC" });
        }

    }
});


app.post("/p4fVCqqbXrYu9RTOl9ZBdq/feedback", async (req, res) => {
    console.log("status:", req.body);
    let items = [];
    const doubleformatEnable = process.env.DOUBLE_FORMAT_ENABLE;
    if (typeof req.body.phonenumber === 'undefined' || typeof req.body.name === 'undefined' || typeof req.body.value === 'undefined' || isNaN(req.body.phonenumber)) {
        console.log("Consent input Error - phone number:", req.body.phonenumber);
        return res.json({ status: "error", message: "missing parameters" });
    }
    else {

        const externalKey = process.env.SFMC_EXTERNAL_KEY_FEEDBACK;
        let today = new Date();
        let dateString = today.toLocaleString("en-US", {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false, // Use 24-hour format
        });

        if ((typeof doubleformatEnable !== 'undefined' || doubleformatEnable !== null) && doubleformatEnable == "true") {
            const numberFormated = parsePhoneNumber("+" + req.body.phonenumber.toString())
            if (numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, "") != req.body.phonenumber) {
                console.log("double needed", numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, ""));
                items.push(
                    {
                        phoneNumber: numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, ""),
                        paramName: req.body.name,
                        paramValue: req.body.value,
                        timestamp: dateString,
                    });
            }
        }

        items.push(
            {
                phoneNumber: req.body.phonenumber,
                paramName: req.body.name,
                paramValue: req.body.value,
                timestamp: dateString,
            });


        const dataToUpsert = { items: items };
        console.log(dataToUpsert);

        try {
            const accessToken = await getAccessToken();
            await upsertDataExtensionRows(accessToken, externalKey, dataToUpsert);
            return res.json({ status: "success" });
        } catch (error) {
            console.error("Error in Upsert:", error);
            return res.json({ status: "error", message: "error in upsert to SFMC" });
        }

    }
});

app.post("/p4fVCqqbXrYu9RTOl9ZBdq/tracking/:jumperId", async (req, res) => {
    console.log("status:", req.body);

    // forward message to Jumper
   //const jumperUrl = `https://jumper.ai/whatsapp/incoming/${req.params.jumperId}`; // https://jumper.ai/whatsapp/incoming/5083304769421312
    const jumperUrl = `https://webhook.site/41078465-59a7-487c-8fca-5a57d1a1f768`;
    const incomingData = req.body;

    // Copy headers safely (optional: filter out some headers)
    const forwardedHeaders = { ...req.headers };
        
    // Remove headers that shouldn't be forwarded
    delete forwardedHeaders['host'];
    delete forwardedHeaders['content-length'];
    delete forwardedHeaders['connection'];

    try {
        const response = await axios.post(jumperUrl, incomingData, {
            headers: forwardedHeaders,
          });


    } catch (error) {
        console.error(
            "Error forwarding to Jumper status URL",
            error.response ? error.response.data : error.message
        );
    }

    // continue processing into marketing cloud

    let items = [];
    const doubleformatEnable = process.env.DOUBLE_FORMAT_ENABLE;
    if (typeof req.body.to === 'undefined' || typeof req.body.from === 'undefined') {
        return res.send(200).json({ status: "error", message: "missing name or value" });
    }
    else {

        let MID = "unknown";
        switch (req.body.from) {
            case "966544259926":
                MID = "KSA";
                break;
            case "5511992007729":
                MID = "BR";
                break;
            default:
                MID = "unmatched";
        }

        const externalKey = process.env.SFMC_EXTERNAL_KEY_TRACKING;
        let today = new Date();
        let dateString = today.toLocaleString("en-US", {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false, // Use 24-hour format
        });

        //console.log("doubleformatEnable",doubleformatEnable);
        if ((typeof doubleformatEnable !== 'undefined' || doubleformatEnable !== null) && doubleformatEnable == "true") {
            const numberFormated = parsePhoneNumber("+" + item.to.toString())
            if (numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, "") != req.body.to) {
                console.log("double needed", numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, ""));
                items.push(
                    {
                        To: numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, ""),
                        From: req.body.from,
                        Channel: req.body.channel,
                        Message_uuid: req.body.message_uuid + "_2",
                        Timestamp: dateString,
                        Status: req.body.status,
                        //client_ref: client_ref,
                        //journeyId: journeyId,
                        //activityId: activityId,
                        MID: MID
                    });
            }
        }

        items.push(
            {
                To: req.body.to,
                From: req.body.from,
                Channel: req.body.channel,
                Message_uuid: req.body.message_uuid,
                Timestamp: dateString,
                Status: req.body.status,
                //client_ref: client_ref,
                //journeyId: journeyId,
                //activityId: activityId,
                MID: MID
            });

        const dataToUpsert = { items: items };
        console.log(dataToUpsert);
        try {
            const accessToken = await getAccessToken();
            await upsertDataExtensionRows(accessToken, externalKey, dataToUpsert);
            return res.json({ status: "success" });;
        } catch (error) {
            console.error("Error in Upsert:", error);
            return res.json({ status: "error", message: "error in upsert to SFMC" });
        }

    }
});

app.post("/tracking/bulk", async (req, res) => {

    const externalKey = process.env.SFMC_EXTERNAL_KEY_TRACKING;
    // this is to manually import 1000 at a time into Marketing cloud
    const bulkImport = req.body; console.log(bulkImport);
    let items = [];
    const doubleformatEnable = process.env.DOUBLE_FORMAT_ENABLE;

    let today = new Date();
    let dateString = today.toLocaleString("en-US", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false, // Use 24-hour format
    });

    bulkImport.forEach(async (item) => {

        if (typeof item.to === 'undefined' || typeof item.from === 'undefined') {
            console.log("skip item", item);
        }
        else {

            let MID = "unknown";
            switch (item.from) {
                case "966544259926":
                    MID = "KSA";
                    break;
                case "5511992007729":
                    MID = "BR";
                    break;
                default:
                    MID = "unmatched";
            }

            //console.log("doubleformatEnable",doubleformatEnable);
            if ((typeof doubleformatEnable !== 'undefined' || doubleformatEnable !== null) && doubleformatEnable == "true") {
                const numberFormated = parsePhoneNumber("+" + item.to.toString())

                // resending with doubled 
                if (numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, "") != item.to) {
                    console.log("double needed", numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, ""));
                    items.push(
                        {
                            To: numberFormated.countryCallingCode + numberFormated.formatNational().replace(/\D/g, ""),
                            From: item.from,
                            Channel: item.channel,
                            Message_uuid: item.message_uuid + "_2",
                            Timestamp: formatDate(item.dateString),
                            Status: item.status,
                            //client_ref: client_ref,
                            //journeyId: journeyId,
                            //activityId: activityId,
                            MID: MID
                        });
                }
            }

            items.push(
                {
                    To: item.to,
                    From: item.from,
                    Channel: item.channel,
                    Message_uuid: item.message_uuid,
                    Timestamp: formatDate(item.dateString),
                    Status: item.status,
                    //client_ref: client_ref,
                    //journeyId: journeyId,
                    //activityId: activityId,
                    MID: MID
                });


        }
    });

    const dataToUpsert = { items: items };
    console.log(dataToUpsert);

    try {
        const accessToken = await getAccessToken();
        await upsertDataExtensionRows(accessToken, externalKey, dataToUpsert);
        return res.json({ status: "success" });
    } catch (error) {
        console.error("Error in Upsert:", error);
        return res.json({ status: "error", message: "error in upsert to SFMC" });
    }


});


function formatDate(inputDate) {
    // Create a Date object from the input string
    const date = new Date(inputDate);

    // Extract the month, day, and year from the Date object
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2); // Get the last two digits of the year

    // Extract the time
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // Combine everything into the desired format
    const formattedDate = `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`;

    return formattedDate;
}