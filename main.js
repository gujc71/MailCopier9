const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { promisify } = require('util');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets', 'favicon.ico')  
  });

  //mainWindow.setPosition(2100, 100);
  mainWindow.loadFile('index.html');
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (sourceImap) sourceImap.end();
  if (targetImap) targetImap.end();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

let sourceImap, targetImap;
// ========================================================================================

ipcMain.on('connectSource', async (event, config) => {
  sourceImap = new Imap(config);
  try {
    await connectImap(sourceImap);
    const mailboxInfo = await getMailboxies(sourceImap, event);

    event.reply('connectSource', mailboxInfo);
  } catch (error) {
    event.reply('logMessage', '[Source] ' + error.errors);
    sourceImap.end();
    sourceImap = null;
  }
});
ipcMain.on('disconnectSource', async (event, config) => {
  if (sourceImap) sourceImap.end();
  sourceImap = null;
});

ipcMain.on('connectTarget', async (event, config) => {
  targetImap = new Imap(config);
  try {
    await connectImap(targetImap);
    const mailboxInfo = await getMailboxies(targetImap, event);

    event.reply('connectTarget', mailboxInfo);
  } catch (error) {
    event.reply('logMessage', '[Target] ' + error.errors);
    targetImap.end();
    targetImap = null;
  }
});
ipcMain.on('disconnectTarget', async (event, config) => {
  if (targetImap) targetImap.end();
  targetImap = null;
});


function connectImap(imap) {
  return new Promise((resolve, reject) => {
    imap.once('ready', resolve);
    imap.once('error', reject);
    imap.connect();
  });
}

async function getMailboxies(imap, event) {
  const mailboxInfo = [];
  try {
    const mailboxes = await listMailboxes(imap);

    for (const box in mailboxes) {
      const boxDetails = await getMailboxDetails(imap, box);
      mailboxInfo.push({ name: box, messages: boxDetails.messages.total });
    }

  } catch (error) {
    console.error('Error fetching mailboxes:', error);
    event.reply('connectSource-response', { error: error.message });
  }
  return mailboxInfo;
}

function listMailboxes(imap) {
  const getBoxesAsync = promisify(imap.getBoxes).bind(imap);
  return getBoxesAsync();
}

function getMailboxDetails(imap, mailbox) {
  const openBoxAsync = promisify(imap.openBox).bind(imap);
  return openBoxAsync(mailbox, true);
}

// ------------------------------------------------------------------------------------------------


// ------------------------------------------------------------------------------------------------
let totalCnt = 0;
let fetchErrorCnt = 0;
let copyErrorCnt = 0;

ipcMain.on('RunCopyEmails', async (event, selectedMailboxList, startDate, endDate) => {
  const sendLog = (message) => {
    event.reply('logMessage', message);
  };
  
  if (!sourceImap) {
    return;
  }
  if (!targetImap) {
    return;
  }

  totalCnt = 0;
  fetchErrorCnt = 0;
  copyErrorCnt = 0;

  let searchCriteria, searchCriteriaStr;

  if (startDate && endDate) {
    searchCriteria = [ ['SINCE', startDate], ['BEFORE', new Date((new Date(endDate)).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)]];
    searchCriteriaStr = `${startDate} ~ ${endDate}`;
  } else {
    searchCriteriaStr = 'ALL';
    searchCriteria = [searchCriteriaStr];
  }

  const startTime = new Date(); 
  sendLog('\n------------------------------------------------------------------------------------');
  sendLog('Start copying emails : ' + searchCriteriaStr);

  try {
    for(const mailbox of selectedMailboxList) {
      await fetchAndCopyEmails(mailbox.source, searchCriteria, mailbox.target, sendLog);
    }
  } catch (error) {
    console.error('Error during email fetch and copy process:', error);
    sendLog(`Error: ${error.message}`);
    sourceImap.end();
    targetImap.end();
  }

  const executionTime = (new Date()) - startTime; 
  
  sendLog( '------------------------------------------------------------------------------------');
  sendLog( 'End copying emails <br/><br/>');
  sendLog( `Total Messages : ${totalCnt}`);
  sendLog( `Fetch Error Messages : ${fetchErrorCnt}`);
  sendLog( `Copy Error Messages : ${copyErrorCnt}`);
  sendLog( `Execution Time: ${Math.round(executionTime/1000/60)} minute`);
});

function openBox(imap, mailbox, readOnly) {
  const openBoxAsync = promisify(imap.openBox).bind(imap);
  return openBoxAsync(mailbox, readOnly);
}

function appendEmail(imap, emlBuffer, mailbox) {
  return new Promise((resolve, reject) => {
    imap.append(emlBuffer, { mailbox }, (err) => {
      if (err) {
        console.error('Error appending email:', err);
        return reject(err);
      }
      resolve();
    });
  });
}

async function fetchAndCopyEmails(sourceMailbox, searchCriteria, destMailbox, sendLog) {
  return new Promise((resolve, reject) => {
    if (!destMailbox || destMailbox==="⇒") destMailbox = sourceMailbox;

    // If the mailbox doesn't exist, create it
    targetImap.openBox(destMailbox, false, (err, box) => {
      if (!err) return;
      targetImap.addBox(destMailbox, (err) => {
        if (err) throw err;
        console.log(`The mailbox [${destMailbox}] was successfully created.`);
      });
    });
    // EMail copy
    sourceImap.openBox(sourceMailbox, true, (err, box) => {
      if (err) return reject(err);

      sourceImap.search(searchCriteria, async (err, results) => {
        if (err) {
          console.error('Error searching emails:', err);
          return reject(err);
        }

        if (results.length === 0) {
          sendLog(`[${sourceMailbox}] - No emails found.`);
          resolve();
          return;
        }
        sendLog(`[${sourceMailbox}] - Found emails : ${results.length}`);
        totalCnt += results.length;

        const f = sourceImap.fetch(results, { bodies: '', struct: true });

        const processEmail = async (msg, seqno) => {
          return new Promise((resolve, reject) => {
            let emlBuffer = Buffer.alloc(0);
            msg.on('body', (stream, info) => {
              stream.on('data', (chunk) => {
                emlBuffer = Buffer.concat([emlBuffer, chunk]);
              });
              stream.on('end', async () => {
                try {
                  const parsed = await simpleParser(emlBuffer);
                  const subject = parsed.subject || 'No Subject';
                  const date = parsed.date || 'No Date';

                  await appendEmail(targetImap, emlBuffer, destMailbox);
                  sendLog(`copied email #${seqno}: ${subject} [${date}]`);
                  resolve();
                } catch (err) {
                  sendLog(`failed to copy email #${seqno}:`, err);
                  reject(err);
                  copyErrorCnt++;
                }
              });
            });
          });
        };

        let promises = [];
        f.on('message', (msg, seqno) => {
          promises.push(processEmail(msg, seqno));
        });

        f.once('error', (err) => {
          sendLog('Fetch error: ' + err);
          reject(err);
          fetchErrorCnt++;
        });

        f.once('end', async () => {
          try {
            await Promise.all(promises);
            resolve();
          } catch (err) {
            sendLog('Error processing emails: ' + err);
            reject(err);
          }
        });
      });
    });
  });
}
