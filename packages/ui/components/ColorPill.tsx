import { cn } from "../lib";

const ColorPill = ({
  color1,
  color2,
  color3,
  onSelect,
  isSelected,
  onSelectColor,
}) =>
  onSelectColor ? (
    <div
      className={cn("flex flex-row items-center rounded-full overflow-hidden", {
        "border-[3px] border-white border-double": isSelected,
      })}
    >
      <button
        type="button"
        className="w-10 h-6"
        style={{ backgroundColor: `#${color1}` }}
        onClick={onSelectColor.bind(null, color1)}
      />
      <button
        type="button"
        className="w-10 h-6"
        style={{ backgroundColor: `#${color2}` }}
        onClick={onSelectColor.bind(null, color2)}
      />
      <button
        type="button"
        className="w-10 h-6"
        style={{ backgroundColor: `#${color3}` }}
        onClick={onSelectColor.bind(null, color3)}
      />
    </div>
  ) : (
    <button
      type="button"
      className={cn("flex flex-row items-center rounded-full overflow-hidden", {
        "border-[3px] border-white border-double": isSelected,
      })}
      onClick={onSelect}
    >
      <div className="w-10 h-6" style={{ backgroundColor: `#${color1}` }} />
      <div className="w-10 h-6" style={{ backgroundColor: `#${color2}` }} />
      <div className="w-10 h-6" style={{ backgroundColor: `#${color3}` }} />
    </button>
  );

export default ColorPill;
