const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

const FILE_URI = '/telemed-frontend/messages.en.json';

// Or put this in subdir
const MESSAGES_PATH = 'build/messages.en.json';
const SMARTLING_ORIGIN = 'https://api.smartling.com';

const {
  SMARTLING_USER_IDENTIFIER: USER_IDENTIFIER,
  SMARTLING_USER_SECRET: USER_SECRET,
  SMARTLING_PROJECT_ID: PROJECT_ID,
} = process.env;

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

async function uploadMessages() {
  if (!fs.existsSync(MESSAGES_PATH)) {
    throw new Error(`messages file not found: ${MESSAGES_PATH}`);
  }

  const accessToken = await getAccessToken();

  const form = new FormData();

  form.append('file', fs.createReadStream(MESSAGES_PATH));
  form.append('fileUri', FILE_URI);
  form.append('fileType', 'json');
  form.append('smartling.string_format', 'icu');
  form.append(
    'smartling.translate_paths',
    JSON.stringify({
      path: '*/defaultMessage',
      key: '*/id',
    }),
  );

  console.error('uploading file');

  const uploadResponse = await fetch(
    `${SMARTLING_ORIGIN}/files-api/v2/projects/${PROJECT_ID}/file`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    },
  );

  let uploadBody;
  try {
    uploadBody = await uploadResponse.json();
  } catch (e) {
    uploadBody = {};
  }

  if (!uploadResponse.ok) {
    console.error('file upload failed', uploadBody.response);
    throw new Error('file upload failed');
  }
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
  uploadMessages().catch(err => {
    console.error(err);
    process.exit(1);
  });
};
