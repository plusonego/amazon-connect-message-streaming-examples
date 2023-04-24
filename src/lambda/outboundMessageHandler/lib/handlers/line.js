// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const https = require('https');
const AWS = require('aws-sdk');
const { log } = require('common-util');

let accessToken = undefined;

const secretManager = new AWS.SecretsManager();

const handler = async (toPhoneNumber, message) => {
  if (message.Type === 'EVENT') {
    log.debug('Ignoring event message', message);
    return;
  }

  if (accessToken === undefined) {
    await getLineSecrets();
  }

  if (accessToken === null) {
    log.error('LN_ACCESS_TOKEN not found in Secrets Manager');
  }

  return await sendMessage(toPhoneNumber, message);
};

const sendMessage = async (toPhoneNumber, message) => {
  const body = {
    to: toPhoneNumber,
    messages:[{ 
      type: 'text',
      text: message.Content 
    }],
  };

  const options = {
    host: 'api.line.me',
    path: '/v2/bot/message/push',
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json' },
  };

  const result = await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        resolve(responseBody);
      });
    });

    req.on('error', (err) => {
      log.error('Error sending LN message', err);
      reject(err);
    });

    req.write(JSON.stringify(body));
    req.end();
  });

  const resultObj = JSON.parse(result);
  log.debug('Send LN Message result', result);

  if (resultObj.error !== undefined) {
    log.error('Error sending LN message', resultObj);
    return false;
  }

  return true;
};

const getLineSecrets = async () => {
  if(process.env.LN_SECRET){
    const params = {
      SecretId: process.env.LN_SECRET
    }
    const response = await secretManager.getSecretValue(params).promise();
    accessToken = JSON.parse(response.SecretString).YOUR_CHANNEL_ACCESS_TOKEN
  } else {
    accessToken = null;
  }
};

module.exports = { handler };