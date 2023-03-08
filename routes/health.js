const express = require('express');

const router = express.Router();

// health endpoint for liveness and readiness check
router.get('/', (req, res) => {
    res.status(200).json({
        message: 'ok',
    });
});

module.exports = router;
