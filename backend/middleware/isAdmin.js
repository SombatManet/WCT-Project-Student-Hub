module.exports = (req, res, next) => {
  // Supabase stores custom data in user_metadata
  const role = req.user.user_metadata?.role;

  if (role !== 'admin') {
    return res.status(403).json({ 
      status: 'fail', 
      message: 'Access Denied: Admins only' 
    });
  }

  next();
};