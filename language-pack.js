import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { Assets, vcr } from '@vonage/vcr-sdk';
import { Buffer } from 'buffer';
import { parse } from 'csv-parse/sync'; // install via: npm i csv-parse

// Recreate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const session = vcr.createSession();
const assets = new Assets(session);

const LANGUAGE_FOLDER = path.join(__dirname, 'language');

export async function returnCSVContentFromAssets(req, res) {
    try {
        //  Is there a phone?
        const phone = req.params.phone;

        //  Output format
        const format = req.query.format || 'json';

        // 1. Ensure my local folder exists
        await fs.mkdir(LANGUAGE_FOLDER, { recursive: true });

        // 2. List all assets and filter CSV or GZ
        const result = await assets.list('', true, 50); // (prefix, recursive, limit)
        const csvOrGzAssets = result.res.filter(f => f.name.endsWith('.csv') || f.name.endsWith('.gz'));

        // 3. Read current files in local folder
        const existingFiles = await fs.readdir(LANGUAGE_FOLDER);

        // 4. Clear local folder if any file is outdated (optional for strict sync)
        const existingBaseNames = new Set(existingFiles.map(f => path.basename(f, path.extname(f))));
        const assetBaseNames = new Set(csvOrGzAssets.map(a => path.basename(a.name, path.extname(a.name))));

        // 4.1. Compare Assets folder with local LANGUAGE_FOLDER. All files must match. Otherwise something's missing
        const isAnyMissing = [...assetBaseNames].some(name => !existingBaseNames.has(name));

        if (isAnyMissing || existingFiles.length !== csvOrGzAssets.length) {

            // Strict sync: Remove all old files form my local language folder
            // You can remove this line if you don't want strict sync
            await Promise.all(existingFiles.map(f => fs.unlink(path.join(LANGUAGE_FOLDER, f))));

            // Download and extract all CSV/GZ assets
            for (const asset of csvOrGzAssets) {
                const assetBaseName = path.basename(asset.name, path.extname(asset.name));
                const fileStream = await assets.getRemoteFile(asset.name);
                const fileBuffer = await streamToBuffer(fileStream);

                // Unzip if it's a .gz file. Do nothing if we see a CSV file
                const csvBuffer = asset.name.endsWith('.gz')
                    ? zlib.gunzipSync(fileBuffer)
                    : fileBuffer;

                const filePath = path.join(LANGUAGE_FOLDER, assetBaseName + '.csv');
                await fs.writeFile(filePath, csvBuffer);
            }
        }

        // 7. Read and merge all .csv files in the LANGUAGE_FOLDER
        const updatedFiles = await fs.readdir(LANGUAGE_FOLDER);
        const csvFiles = updatedFiles.filter(f => f.endsWith('.csv'));

        if (csvFiles.length === 0) {
            if (format === 'json') {
                return res.json({"language":"not-found"})   
            } else {
                return res.send('');
            }
        }

        // Marge all the files inside LANGUAGE_FOLDER
        let mergedText = '';
        let headersSet = new Set();

        for (const file of csvFiles) {
            const filePath = path.join(LANGUAGE_FOLDER, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const [headerLine, ...lines] = content.split('\n').filter(Boolean);

            if (!headersSet.has(headerLine)) {
                mergedText += headerLine + '\n';
                headersSet.add(headerLine);
            }

            mergedText += lines.join('\n') + '\n';
        }

        //  Check what returning format the customer wants  
        if (format === 'json') {
            const records = parse(mergedText, {
                columns: true,
                skip_empty_lines: true,
                delimiter: '|',
                trim: true
            });

            // Defensive mapping using keys found in the first row
            const mapped = {};
            if (records.length > 0) {
                const firstRowKeys = Object.keys(records[0]);
                const phoneKey = firstRowKeys.find(k => k.toLowerCase().includes('phone'));
                const langKey = firstRowKeys.find(k => k.toLowerCase().includes('lang'));

                if (!phoneKey || !langKey) {
                    console.warn('Header keys not found:', firstRowKeys);
                }

                for (const row of records) {
                    const phoneNum = row[phoneKey]?.trim();
                    const lang = row[langKey]?.trim();
                    if (phoneNum && lang) {
                        mapped[phoneNum] = lang;
                    }
                }
            }

            // If a specific phone is requested, return only that
            if (phone) {
                const language = mapped[phone];
                if (language) {
                    return res.json({ language });
                } else {
                    return res.json({"language":"not-found"})
                }
            }

            // Otherwise, return the full map
            res.json(mapped);

        } else {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', 'inline');

            if (phone) {
                const lines = mergedText.split('\n');
                const header = lines[0];
                const matchLine = lines.find(line => line.startsWith(phone + '|'));

                if (matchLine) {
                    res.send([header, matchLine].join('\n'));
                } else {
                    res.send('');
                }
            } else {
                res.send(mergedText);
            }
        }

    } catch (err) {
        console.error('Error in /language handler:', err);
        res.status(500).send('Internal Server Error');
    }
}


function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}