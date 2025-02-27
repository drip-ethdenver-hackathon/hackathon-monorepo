import { HexColorPicker, HexColorInput } from "react-colorful";
import { Popover, PopoverTrigger, PopoverContent } from "@nextui-org/react";
import { cn } from "../lib";

const ColorPillPicker = ({ colors, onChange, isSelected }) => {
  return (
    <div
      className={cn("flex flex-row items-center rounded-full overflow-hidden", {
        "border-[3px] border-white border-double": isSelected,
      })}
    >
      {colors?.map((color, index) => (
        <Popover key={`${color}_${index}`} placement="top">
          <PopoverTrigger>
            <div
              role="button"
              className="w-10 h-6"
              style={{ backgroundColor: `#${color}` }}
            />
          </PopoverTrigger>
          <PopoverContent>
            <HexColorPicker
              color={color}
              onChange={(newColor) => {
                onChange(index, newColor);
              }}
            />
            <HexColorInput
              color={color}
              onChange={(newColor) => {
                onChange(index, newColor);
              }}
            />
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
};

export default ColorPillPicker;
