#!/usr/bin/env python3
"""
Generate icon images for Chrome extension
Creates 16x16, 48x48, and 128x128 PNG icons
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    """Create a simple icon with 'E' letter for Env Marker"""
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate dimensions
    padding = size // 10
    radius = size // 2 - padding
    center = size // 2
    
    # Draw a colored circle background
    # Using a blue-ish color (#4A90E2)
    circle_color = (74, 144, 226, 255)
    draw.ellipse(
        [padding, padding, size - padding, size - padding],
        fill=circle_color,
        outline=None
    )
    
    # Draw a white 'E' or marker symbol
    # For simplicity, we'll draw a rectangular marker shape
    marker_color = (255, 255, 255, 255)
    
    # Draw a simple marker/flag shape
    marker_width = size // 3
    marker_height = size // 2
    marker_x = center - marker_width // 2
    marker_y = center - marker_height // 2
    
    # Main rectangle
    draw.rectangle(
        [marker_x, marker_y, marker_x + marker_width, marker_y + marker_height],
        fill=marker_color
    )
    
    # Add a small colored accent (representing different environments)
    accent_height = marker_height // 3
    accent_colors = [
        (255, 102, 102, 255),  # Red
        (102, 255, 178, 255),  # Green
        (255, 204, 102, 255),  # Yellow
    ]
    
    for i, color in enumerate(accent_colors):
        y_pos = marker_y + i * accent_height
        draw.rectangle(
            [marker_x, y_pos, marker_x + marker_width, y_pos + accent_height - 1],
            fill=color
        )
    
    return img

def main():
    # Create icons directory if it doesn't exist
    icons_dir = 'public/icons'
    os.makedirs(icons_dir, exist_ok=True)
    
    # Generate icons in different sizes
    sizes = [16, 48, 128]
    
    for size in sizes:
        icon = create_icon(size)
        filename = f'{icons_dir}/icon{size}.png'
        icon.save(filename, 'PNG')
        print(f'Created {filename}')
    
    print('\nIcons created successfully!')
    print('Add these to your wxt.config.ts manifest:')
    print('''
  manifest: {
    icons: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  }
''')

if __name__ == '__main__':
    main()
