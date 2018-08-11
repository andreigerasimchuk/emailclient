const Pop3Client = require('poplib');
const base64 = require('base64-stream');
const MailParser = require('mailparser');
const { promiseLimit } = require('./utils');

class Pop3 {
  constructor({ host, port, tls, username, password }) {
    this.host = host;
    this.port = port;
    this.tls = tls || false;
    this.username = username;
    this.password = password;

    this.connected = false;
  }

  connect() {
    this.transport = new Pop3Client(this.port, this.host, { enabletls: this.tls, debug: false });
    return new Promise((resolve, reject) => {
      this.transport.once('connect', () => {
        this.transport.login(this.username, this.password)
        this.transport.once('login', (status, response) => {
          if (!status) {
            return reject(response);
          }
          return resolve(response);
        });
      });
    });
  }

  getFolders() {
    return Promise.resolve([]);
  }

  openFolder(folder) {
    return Promise.resolve();
  }

  getUIDs() {
    this.transport.uidl();
    return new Promise((resolve, reject) => {
      this.transport.once('uidl', (status, msgnumber, data, rawdata) => {
        if (!status) {
          return reject(data);
        }
        return resolve(data)
      });
    });
  }

  async getAll() {
    const uids = await this.getUIDs();
    const messages = [];
    await promiseLimit(uids, 1, async (uid) => {
      const message = await this.getByUid(uid, uids);
      messages.push(message);
    });
    return messages;
  }

  async getByUid(uid, _uids = undefined) {
    let uids = _uids
    if (!_uids) {
      uids = await this.getUIDs();
    }
    uids = await this.getUIDs();
    const index = uids.findIndex(x => x === uid);
    if (index < 0) {
      return Promise.reject(new Error(`Email with UID=${uid} was not found`));
    }
    this.transport.retr(index);
    return new Promise((resolve, reject) => {
      this.transport.once('retr', async (status, msgnumber, data, rawdata) => {
        if (!status) {
          return reject(data);
        }
        const mail = await MailParser.simpleParser(data);
        resolve(mail);
      });
    });
  }
}

module.exports = Pop3;
