const ImapClient = require('imap');
const base64 = require('base64-stream');
const MailParser = require('mailparser');
const { promiseLimit } = require('./utils');

class Imap {
  constructor({ host, port, tls, username, password }) {
    this.host = host;
    this.port = port;
    this.tls = tls || false;
    this.username = username;
    this.password = password;

    this.connected = false;
  }

  connect() {
    const imap = new ImapClient({
      user: this.username,
      password: this.password,
      host: this.host,
      port: this.port,
      tls: this.tls,
    });
    this.imap = imap;
    return new Promise((resolve, reject) => {
      imap.once('ready', () => {
        resolve();
      });
      imap.once('error', (err) => {
        reject(err);
      });
      imap.connect();
    });
  }

  _parseFolders(data) {
    const folders = [];
    Object.keys(data).forEach(root => {
      const item = data[root];
      const canSelect = item.attribs && item.attribs.find(x => x.indexOf('Noselect') >= 0) == null;
      if (!canSelect && !item.children) {
        return;
      }
      if (canSelect) {
        folders.push(root);
      }
      if (item.children) {
        const childItems = this._parseFolders(item.children);
        folders.push(...childItems.map(x => `${root}${item.delimiter}${x}`));
      }
    });
    return folders;
  }

  getFolders() {
    return new Promise((resolve, reject) => {
      this.imap.getBoxes((err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(this._parseFolders(data));
      });
    });
  }

  openFolder(folder) {
    return new Promise((resolve, reject) => {
      this.imap.openBox(folder, true, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  }

  getUIDs() {
    const messages = [];
    return new Promise((resolve, reject) => {
      this.imap.search(['ALL'], (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  }

  async getAll() {
    const uids = await this.getUIDs();
    const messages = [];
    await promiseLimit(uids, 5, async (uid) => {
      const message = await this.getByUid(uid);
      messages.push(message);
    });
    return messages;
  }

  getByUid(uid) {
    return new Promise((resolve, reject) => {
      const f = this.imap.fetch(uid, {
        bodies: [''],
        struct: true
      });
      f.once('message', (msg, seqno) => {
        let data = '';
        msg.on('body', (stream, info) => {
          stream.on('data', (chunk) => {
            data += chunk.toString('utf8');
          });
          stream.once('end', async () => {
            const parsed = await MailParser.simpleParser(data);
            resolve(parsed);
          });
        });
        msg.once('attributes', (attrs) => {
        });
        msg.once('end', () => {
        });
      });
      f.once('error', (err) => {
        reject(err);
      });
      f.once('end', () => {
      });
    });
  }
}

module.exports = Imap;
