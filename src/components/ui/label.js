const { cn } = require("../../lib/utils");

const Label = ({ className, ...props }) => {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
};
Label.displayName = "Label";

module.exports = {
  Label,
}; 