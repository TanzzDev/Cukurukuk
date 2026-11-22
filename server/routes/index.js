'use strict';
const express = require('express');
const { sameOriginGuard, handleError } = require('../lib/http');

const router = express.Router();
router.use('/auth', sameOriginGuard, express.json({ limit: '16kb' }), require('./auth'));
router.use('/me', sameOriginGuard, express.json({ limit: '64kb' }), require('./me'));
router.use('/', require('./misc'));
// error handler tunggal agar semua respons konsisten: { status:false, code, message }
router.use((err, req, res, next) => handleError(res, err));

module.exports = router;
