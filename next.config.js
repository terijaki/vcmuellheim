/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
	output: "export",
	images: {
		loader: "custom",
		imageSizes: [16, 96, 256],
		deviceSizes: [640, 750, 1080, 1920],
	},
	transpilePackages: ["next-image-export-optimizer"],
	env: {
		nextImageExportOptimizer_imageFolderPath: "public/images",
		nextImageExportOptimizer_exportFolderPath: "out",
		nextImageExportOptimizer_quality: "50",
		nextImageExportOptimizer_storePicturesInWEBP: "true",
		nextImageExportOptimizer_exportFolderName: "optimized",
		// If you do not want to use blurry placeholder images, then you can set
		// nextImageExportOptimizer_generateAndUseBlurImages to false and pass
		// `placeholder="empty"` to all <ExportedImage> components.
		nextImageExportOptimizer_generateAndUseBlurImages: "true",
	},
};
module.exports = nextConfig;
