// TODO share code with Oolympus frontend

const fs = require('fs');
const JSONStream = require('JSONStream');
const fetch = require('node-fetch');
const path = require('path');
const unzipper = require('unzipper');

const FILE_URI = '/telemed-frontend/messages.en.json';
const OUT_DIR = 'build';

// Or put this in subdir
const SMARTLING_ORIGIN = 'https://api.smartling.com';
const PSEUDO_LOCALE = 'en-gb';

const {
  BNI_ENV,
  SMARTLING_USER_IDENTIFIER: USER_IDENTIFIER,
  SMARTLING_USER_SECRET: USER_SECRET,
  SMARTLING_PROJECT_ID: PROJECT_ID,
} = process.env;

const TAG_ALIASES = new Map([
  ['en-US', 'en'],
  ['nl-NL', 'nl'],
  ['fi-FI', 'fi'],
  ['fr-FR', 'fr'],
  ['de-DE', 'de'],
  ['it-IT', 'it'],
  ['nb-NO', 'nb'],
  ['pl-PL', 'pl'],
  ['pt-PT', 'pt'],
  ['es-ES', 'es'],
  ['sv-SE', 'sv'],
]);

async function getAccessToken() {
  console.error('authenticating');

  const authResponse = await fetch(
    `${SMARTLING_ORIGIN}/auth-api/v2/authenticate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIdentifier: USER_IDENTIFIER,
        userSecret: USER_SECRET,
      }),
    },
  );

  let authBody;
  try {
    authBody = await authResponse.json();
  } catch (e) {
    authBody = {};
  }

  if (!authResponse.ok) {
    console.error('authentication failed', authBody.response);
    throw new Error('authentication failed');
  }

  const { accessToken } = authBody.response.data;
  return accessToken;
}

function writeMessages(entry, locale) {
  console.error('parsing', locale);
  return new Promise((resolve, reject) => {
    entry
      .pipe(
        JSONStream.parse('.$*', ({ id, defaultMessage }) =>
          defaultMessage ? [id, defaultMessage] : null,
        ),
      )
      .pipe(JSONStream.stringifyObject('{\n', ',\n', '\n}\n', 2))
      .pipe(fs.createWriteStream(`${OUT_DIR}/messages.${locale}.json`))
      .on('finish', resolve)
      .on('error', reject);
  });
}

async function downloadPsuedoTranslation(accessToken) {
  const query = new URLSearchParams({
    fileUri: FILE_URI,
    retrievalType: 'pseudo',
  });

  const resp = await fetch(
    `${SMARTLING_ORIGIN}/files-api/v2/projects/${PROJECT_ID}/locales/${PSEUDO_LOCALE}/file?${query}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!resp.ok) {
    console.error('Pseudo Translation download failed', await resp.text());
    return undefined;
  }

  return resp;
}

async function downloadMessages() {
  const accessToken = await getAccessToken();

  const query = new URLSearchParams({
    fileUri: FILE_URI,
    retrievalType: 'published',
    includeOriginalStrings: false,
  });

  console.error('downloading files');

  const [resp, pseudoResp] = await Promise.all([
    fetch(
      `${SMARTLING_ORIGIN}/files-api/v2/projects/${PROJECT_ID}/locales/all/file/zip?${query}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    ),
    BNI_ENV === 'dev' && downloadPsuedoTranslation(accessToken),
  ]);

  if (!resp.ok) {
    console.error('file download failed', await resp.text());
    throw new Error('file download failed');
  }

  // ensure english is included so that more specific (unsupported) sub tags match something
  const locales = ['en'];

  await Promise.all([
    pseudoResp && writeMessages(pseudoResp.body, PSEUDO_LOCALE),
    resp.body
      .pipe(unzipper.Parse())
      .on('entry', entry => {
        let [locale] = entry.path.split(path.sep);

        locale = TAG_ALIASES.get(locale) || locale;
        // normalize all locales to lowercase for consistency
        locale = locale.toLowerCase();
        locales.push(locale);

        if (locale === PSEUDO_LOCALE && pseudoResp) {
          entry.autodrain();
          return;
        }

        writeMessages(entry, locale);
      })
      .promise(),
  ]);

  console.error('Done writing messages');
  console.log(JSON.stringify(locales));
}

exports.command = '$0 [paths..]';

exports.describe = 'todo';

exports.builder = _ => _;
// _.positional('paths', {
//   type: 'string',
//   describe: 'A glob selecting messages JSON files',
// }).option('out-dir', {
//   alias: 'd',
//   string: true,
// });

exports.handler = () => {
  downloadMessages().catch(err => {
    console.error(err);
    process.exit(1);
  });
};
