# Extension Icons and Images

## Required Images

### icon.png
- Size: 128x128 pixels
- Format: PNG with transparency
- Purpose: Extension marketplace icon
- Design: Gear shift / toggle switch concept

### demo.gif (optional)
- Purpose: Showcase extension in action
- Show: Clicking status bar, mode picker appearing, switching modes

## Creating the Icon

You can create an icon using:

1. **Simple SVG approach** - Use gear/switch/toggle concept
2. **Design tools** - Figma, Sketch, Photoshop
3. **Icon generators** - Online tools

### Concept Ideas

- Gear shift lever (like in a car)
- Toggle switch (ON/OFF)
- Two gears overlapping
- Lightning bolt + Book icons combined
- Binary switch indicator

## Placeholder Icon

For now, you can use a simple placeholder. Here's how to create one:

### Using ImageMagick
```bash
convert -size 128x128 xc:white -font Arial -pointsize 24 \
  -fill black -gravity center -annotate +0+0 "VS" \
  icon.png
```

### Using online tool
Visit https://www.favicon-generator.org/ and create a 128x128 icon

## File Structure

```
images/
├── icon.png        (required - 128x128)
├── demo.gif        (optional - demonstration)
├── vibe-icon.png   (optional - status bar icon for VIBE)
├── dev-icon.png    (optional - status bar icon for DEV)
└── README.md       (this file)
```

## Note

The extension will work without custom icons - VSCode will use default icons from its icon library (codicons) for status bar items.


