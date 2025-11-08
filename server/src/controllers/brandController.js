import User from '../models/User.js';

export const getMyBrand = async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const u = await User.findById(req.user._id).select('companyName brandAbout brandPerks brandLogoUrl brandCoverUrl brandSocials').lean();
    res.json(u || {});
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch brand' });
  }
};

export const updateMyBrand = async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { companyName, brandAbout, brandPerks, brandLogoUrl, brandCoverUrl, brandSocials } = req.body || {};

    const doc = await User.findById(req.user._id);
    if (!doc) return res.status(404).json({ error: 'User not found' });
    if (companyName !== undefined) doc.companyName = companyName;
    if (brandAbout !== undefined) doc.brandAbout = brandAbout;
    if (brandPerks !== undefined) doc.brandPerks = Array.isArray(brandPerks) ? brandPerks : String(brandPerks||'').split(',').map(s=>s.trim()).filter(Boolean);
    if (brandLogoUrl !== undefined) doc.brandLogoUrl = brandLogoUrl;
    if (brandCoverUrl !== undefined) doc.brandCoverUrl = brandCoverUrl;
    if (brandSocials !== undefined) doc.brandSocials = brandSocials;
    await doc.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update brand' });
  }
};

export const getBrandByCompany = async (req, res) => {
  try {
    const { name } = req.query || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    // Case-insensitive match on employer companyName
    const doc = await User.findOne({ role: 'employer', companyName: { $regex: new RegExp(`^${name}$`, 'i') } })
      .select('companyName brandAbout brandPerks brandLogoUrl brandCoverUrl brandSocials')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Brand not found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch brand' });
  }
};

export default { getMyBrand, updateMyBrand };
