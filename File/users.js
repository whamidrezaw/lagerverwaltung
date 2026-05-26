const router  = require('express').Router();
const c       = require('../controllers/userController');
const { protect }   = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleCheck');

router.get('/',                  protect, adminOnly, c.getAllUsers);
router.post('/',                 protect, adminOnly, c.createUser);
router.put('/sort-order',        protect, adminOnly, c.updateSortOrder);
router.put('/:id',               protect, adminOnly, c.updateUser);
router.put('/:id/balance',       protect, adminOnly, c.updateBalance);
router.put('/:id/password',      protect, c.changePassword);
router.delete('/:id',            protect, adminOnly, c.deleteUser);

module.exports = router;
