const User = require('../models/User');

const getAllUsers = async (req, res) => {
  try { res.json(await User.findAll()); }
  catch(e) { res.status(500).json({ message:'Serverfehler.' }); }
};

const createUser = async (req, res) => {
  try {
    const { name, username, password, role, employment_type, weekly_hours, email, phone } = req.body;
    if (!name||!username||!password||!employment_type||weekly_hours===undefined)
      return res.status(400).json({ message:'Pflichtfelder fehlen.' });
    if (await User.findByUsername(username.trim().toLowerCase()))
      return res.status(409).json({ message:'Benutzername bereits vergeben.' });
    const id = await User.create({ name:name.trim(), username:username.trim().toLowerCase(),
      password, role:role||'employee', employment_type, weekly_hours:parseFloat(weekly_hours),
      email:email?.trim()||null, phone:phone?.trim()||null });
    res.status(201).json({ message:'Mitarbeiter angelegt.', id });
  } catch(e) { console.error(e); res.status(500).json({ message:'Serverfehler.' }); }
};

const updateUser = async (req, res) => {
  try {
    // Username-Eindeutigkeit prüfen wenn geändert
    if (req.body.username) {
      const existing = await User.findByUsername(req.body.username.trim().toLowerCase());
      if (existing && existing.id !== parseInt(req.params.id))
        return res.status(409).json({ message:'Benutzername bereits vergeben.' });
      req.body.username = req.body.username.trim().toLowerCase();
    }
    const ok = await User.update(req.params.id, req.body);
    if (!ok) return res.status(400).json({ message:'Keine Änderungen.' });
    res.json({ message:'Daten aktualisiert.' });
  } catch(e) { res.status(500).json({ message:'Serverfehler.' }); }
};

const updateBalance = async (req, res) => {
  try {
    const { balance } = req.body;
    if (balance===undefined||isNaN(parseFloat(balance)))
      return res.status(400).json({ message:'Ungültiger Wert.' });
    await User.updateBalance(req.params.id, balance);
    res.json({ message:'Guthaben aktualisiert.' });
  } catch(e) { res.status(500).json({ message:'Serverfehler.' }); }
};

const updateSortOrder = async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ message:'Ungültige Reihenfolge.' });
    await User.updateSortOrder(orderedIds);
    res.json({ message:'Reihenfolge gespeichert.' });
  } catch(e) { res.status(500).json({ message:'Serverfehler.' }); }
};

const changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (req.user.role!=='admin' && req.user.id!==parseInt(req.params.id))
      return res.status(403).json({ message:'Zugriff verweigert.' });
    if (!newPassword||newPassword.length<6)
      return res.status(400).json({ message:'Passwort min. 6 Zeichen.' });
    await User.updatePassword(req.params.id, newPassword);
    res.json({ message:'Passwort geändert.' });
  } catch(e) { res.status(500).json({ message:'Serverfehler.' }); }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message:'Mitarbeiter nicht gefunden.' });
    if (user.role==='admin') return res.status(403).json({ message:'Admin kann nicht gelöscht werden.' });
    await User.deleteUser(req.params.id);
    res.json({ message:`${user.name} wurde gelöscht.` });
  } catch(e) { console.error(e); res.status(500).json({ message:'Serverfehler.' }); }
};

module.exports = { getAllUsers, createUser, updateUser, updateBalance, updateSortOrder, changePassword, deleteUser };
