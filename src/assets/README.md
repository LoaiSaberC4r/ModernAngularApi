# Offline Map Tiles - Download Required

⚠️ **The offline map tiles are NOT included in this repository due to their large size (~307 MB).**

## Quick Setup

To get the map working in your local environment, follow these steps:

### Option 1: Download from Releases (Recommended)

1. Go to [Releases](https://github.com/YOUR_USERNAME/ModernAngularApi/releases/latest)
2. Download `tiles.zip` (307 MB)
3. Extract the contents to this directory (`src/assets/tiles/`)
4. Your folder structure should look like:
   ```
   src/assets/tiles/
     ├── 6/
     ├── 7/
     ├── 8/
     ├── 9/
     ├── 10/
     ├── 11/
     ├── 12/
     ├── 13/
     └── 14/
   ```

### Option 2: Download from Cloud Storage

📥 [Download tiles.zip from Google Drive](YOUR_GOOGLE_DRIVE_LINK_HERE)

📥 [Download tiles.zip from OneDrive](YOUR_ONEDRIVE_LINK_HERE)

After downloading, extract to `src/assets/tiles/` as shown above.

## Verification

After extraction, you should see multiple numbered folders (6-14) inside `src/assets/tiles/`. Each folder contains map tile images organized by zoom level.

## Running the Application

Once the tiles are in place:

```bash
npm install
ng serve -o
```

The offline map will load automatically! 🗺️

## Troubleshooting

### Map appears blank or shows "no tile" placeholders

- **Cause**: Tiles were not extracted to the correct location
- **Solution**: Verify the folder structure matches the example above

### Console shows 404 errors for tile images

- **Cause**: Tiles folder is missing or empty
- **Solution**: Re-download and extract `tiles.zip` to `src/assets/tiles/`

## Technical Details

- **Map Library**: Leaflet.js
- **Tile Source**: OpenStreetMap (pre-downloaded for offline use)
- **Coverage Area**: Egypt (Latitude: 22-32, Longitude: 24-37)
- **Zoom Levels**: 6 (country view) to 14 (street detail)
- **Total Size**: ~307 MB compressed, ~600 MB uncompressed

## Need Help?

If you encounter issues, please open an issue on GitHub with:

- Your operating system
- Error messages from browser console
- Screenshot of your `src/assets/` folder structure
