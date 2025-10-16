const express = require("express");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

// Configure with env vars
const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.post("/upload-receipt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const fileExt = req.file.originalname.split(".").pop() || "jpg";
    const fileName = `receipt-${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("receipts")
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
    if (error) return res.status(500).json({ error: error.message });
    const { data: publicData } = supabase.storage
      .from("receipts")
      .getPublicUrl(data.path);
    return res.json({ publicUrl: publicData.publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

app.listen(PORT, () => console.log(`Upload proxy listening on ${PORT}`));
