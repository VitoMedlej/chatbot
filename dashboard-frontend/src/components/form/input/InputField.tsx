import React, { FC } from "react";

interface InputProps {
  type?: "text" | "number" | "email" | "password" | "date" | "time" | string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  success?: boolean;
  error?: boolean;
  hint?: string;
}

const Input: FC<InputProps> = ({
  type = "text",
  id,
  name,
  placeholder,
  value,
  onChange,
  required = false,
  className = "",
  min,
  max,
  step,
  disabled = false,
  success = false,
  error = false,
  hint,
}) => (
  <input
    type={type}
    id={id}
    name={name}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    required={required}
    min={min}
    max={max}
    step={step}
    disabled={disabled}
    aria-invalid={error}
    aria-describedby={hint}
    className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition
      ${error ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-brand-500"}
      ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}
      ${className}`}
  />
);

export default Input;