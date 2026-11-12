const multer = require('multer')

const allowedTypes = new Set([ 'application/pdf', 'image/jpeg', 'image/png' ])
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 2 },
    fileFilter: (req, file, callback) => {
        if (!allowedTypes.has(file.mimetype)) {
            return callback(new Error('Upload a PDF, JPG, or PNG document.'))
        }
        callback(null, true)
    },
}).fields([
    { name: 'license', maxCount: 1 },
    { name: 'identity', maxCount: 1 },
])

module.exports = (req, res, next) => {
    upload(req, res, (error) => {
        if (error) {
            return res.status(400).json({ message: error.message || 'Could not upload KYC documents.' })
        }
        next()
    })
}
