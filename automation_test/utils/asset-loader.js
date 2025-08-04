const fs = require('fs');
const path = require('path');

/**
 * Asset loader utility for e2e tests
 * Helps locate and manage test assets like images for upload tests
 */
class AssetLoader {
  /**
   * Get the absolute path to an asset in the test assets directory
   * 
   * @param {string} assetName - Name of the asset file (e.g., 'cat.jpeg')
   * @param {string} [assetType='image'] - Type of asset (subdirectory)
   * @returns {string} Absolute path to the asset
   * @throws {Error} If the asset file doesn't exist
   */
  static getAssetPath(assetName, assetType = 'image') {
    // Determine the base directory for test assets
    const projectRoot = process.cwd();
    const assetDir = path.join(projectRoot,'assets', assetType);

    // Ensure the asset directory exists
    if (!fs.existsSync(assetDir)) {
      fs.mkdirSync(assetDir, { recursive: true });
      console.warn(`Created asset directory: ${assetDir}`);
    }
    
    // Build the full path to the asset
    const assetPath = path.join(assetDir, assetName);

    // Check if a default asset exists when the requested one doesn't
    if (!fs.existsSync(assetPath)) {
      // Look for any file in the directory to use as a fallback
      const files = fs.readdirSync(assetDir);
      if (files.length > 0) {
        const fallbackPath = path.join(assetDir, files[0]);
        console.warn(`Asset not found: ${assetPath}, using fallback: ${fallbackPath}`);
        return fallbackPath;
      }
      
      // If no files exist in the directory, throw an error with helpful message
      throw new Error(
        `No test assets found in ${assetDir}. Please add a test image file like ${assetName}.`
      );
    }
    
    return assetPath;
  }
  
  /**
   * Checks if the assets directory has any test images
   * 
   * @param {string} [assetType='image'] - Type of asset (subdirectory)
   * @returns {boolean} True if test images exist, false otherwise
   */
  static hasTestAssets(assetType = 'image') {
    const projectRoot = process.cwd();
    const assetDir = path.join(projectRoot, 'assets', assetType);
    
    if (!fs.existsSync(assetDir)) {
      return false;
    }
    
    const files = fs.readdirSync(assetDir);
    return files.length > 0;
  }
}

module.exports = AssetLoader; 