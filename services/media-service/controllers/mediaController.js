const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSecret } = require('agriconnect-shared/utils/secrets');
const crypto = require('crypto');

let s3Client = null;
let buckets = null;

async function initS3() {
  if (s3Client && buckets) return;

  const region = process.env.AWS_REGION || 'us-east-1';
  const s3Config = await getSecret('agriconnect/dev/s3');

  // On EC2 with an IAM role the SDK auto-detects credentials from the instance
  // metadata service. Only inject explicit keys when running locally and the
  // secret contains a real access_key (set to "USE_IAM_ROLE" to skip).
  const clientConfig = { region };
  try {
    const awsConfig = await getSecret('agriconnect/dev/aws');
    if (awsConfig.access_key && awsConfig.access_key !== 'USE_IAM_ROLE') {
      clientConfig.credentials = {
        accessKeyId: awsConfig.access_key,
        secretAccessKey: awsConfig.secret_key
      };
    }
  } catch (_) {
    // No explicit credentials secret – rely on the IAM instance profile
  }

  s3Client = new S3Client(clientConfig);
  buckets = s3Config;
}

exports.uploadProduceImage = async (req, res) => {
  try {
    await initS3();
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowed.includes(fileExt)) return res.status(400).json({ error: 'Only jpg, jpeg, png, webp allowed' });

    const fileName = `produce_${crypto.randomBytes(16).toString('hex')}.${fileExt}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: buckets.produce_bucket,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }));

    const imageUrl = `https://${buckets.produce_bucket}.s3.amazonaws.com/${fileName}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error('S3 Upload Error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

exports.uploadDeliveryProof = async (req, res) => {
  try {
    await initS3();
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `proof_${crypto.randomBytes(16).toString('hex')}.${fileExt}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: buckets.delivery_bucket,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }));

    res.json({ message: 'Delivery proof uploaded', fileKey: fileName });
  } catch (error) {
    console.error('S3 Upload Error:', error);
    res.status(500).json({ error: 'Failed to upload proof' });
  }
};

exports.deleteProduceImage = async (req, res) => {
  try {
    await initS3();
    const { fileKey } = req.body;
    if (!fileKey) return res.status(400).json({ error: 'fileKey is required' });

    await s3Client.send(new DeleteObjectCommand({ Bucket: buckets.produce_bucket, Key: fileKey }));
    res.json({ message: 'Image deleted' });
  } catch (error) {
    console.error('S3 Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};
