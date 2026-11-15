const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { canOpen, makeLink, checkLink, localName, isCloud, sendLocal, sendCloud } = require('../services/fileAccess');

/**
 * Private documents (see services/fileAccess.js)
 *   GET /api/files/link?src=...   signed in; returns a link that works for 5 minutes
 *   GET /api/files/view?...       opens the file if the link is valid and not expired
 */
router.get('/link', authMiddleware, async (req, res) => {
  try {
    const src = String(req.query.src || '').trim();
    if (!src) return res.status(400).json({ message: 'No file given.' });
    if (!(await canOpen(src, req.user))) {
      return res.status(403).json({ message: "You don't have access to this document." });
    }
    res.json({ url: makeLink(req, src), expiresInMinutes: 5 });
  } catch (error) {
    console.error('[FILES] link error:', error.message);
    res.status(500).json({ message: 'Could not open the document. Please try again.' });
  }
});

router.get('/view', async (req, res) => {
  const { src, exp, sig } = req.query;
  if (!checkLink(src, exp, sig)) {
    return res.status(403).send('This document link has expired. Go back and open the document again.');
  }
  try {
    if (isCloud(src)) return await sendCloud(res, src);
    const name = localName(src);
    if (!name || !sendLocal(res, name)) return res.status(404).send('Document not found.');
  } catch (error) {
    console.error('[FILES] view error:', error.message);
    if (!res.headersSent) res.status(502).send('Could not load the document. Please try again.');
  }
});

module.exports = router;
