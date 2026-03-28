// Updated to use page/limit pagination for /me/saved and /me/reports

// Importing necessary modules
import express from 'express';

const router = express.Router();

// Example of using pagination for /me/saved
router.get('/me/saved', async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    // Logic to fetch saved items
    const results = await getSavedItems(req.user.id, page, limit);
    const count = await getSavedItemsCount(req.user.id);
    res.json({ meta: { page, limit, total: count }, data: results });
});

// Example of using pagination for /me/reports
router.get('/me/reports', async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    // Logic to fetch reports
    const results = await getReports(req.user.id, page, limit);
    const count = await getReportsCount(req.user.id);
    res.json({ meta: { page, limit, total: count }, data: results });
});

export default router;