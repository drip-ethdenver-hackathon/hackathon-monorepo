import React from "react";
import ColorPillPicker from "./ColorPill";

const ColorPaletteDisplay = ({ palettes, selected, onSelect }) => (
  <div className="flex flex-col gap-4">
    {Object.entries(palettes).map(([category, colors]) => (
      <div key={category} className="gap-4">
        <h2 className="font-bold mb-2 capitalize">{category}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {colors.map((colorString, index) => {
            const [color1, color2, color3] = colorString.split("_");
            return (
              <ColorPillPicker
                key={`${colorString}_${index}`}
                color1={color1}
                color2={color2}
                color3={color3}
                onSelect={onSelect.bind(null, colorString)}
                isSelected={selected === colorString}
              />
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

export default ColorPaletteDisplay;
