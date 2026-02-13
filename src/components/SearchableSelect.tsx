/**
 * @file SearchableSelect — Filterable dropdown using MUI Autocomplete
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { Autocomplete, TextField } from '@mui/material';

interface Option {
  label: string;
  value: string;
}

interface Props {
  options: string[] | Option[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  helperText?: string;
  placeholder?: string;
  /** Allow empty value — shown as first option */
  allowEmpty?: boolean;
  emptyLabel?: string;
}

function normalizeOptions(options: string[] | Option[]): Option[] {
  if (options.length === 0) return [];
  if (typeof options[0] === 'string') {
    return (options as string[]).map((o) => ({ label: o, value: o }));
  }
  return options as Option[];
}

export default function SearchableSelect({
  options: rawOptions, value, onChange, label, disabled,
  fullWidth, size = 'small', helperText, placeholder,
  allowEmpty, emptyLabel = '—',
}: Props) {
  const options = normalizeOptions(rawOptions);
  const allOptions = allowEmpty
    ? [{ label: emptyLabel, value: '' }, ...options]
    : options;

  const selected = allOptions.find((o) => o.value === value) || null;

  return (
    <Autocomplete
      options={allOptions}
      value={selected}
      onChange={(_, opt) => onChange(opt?.value ?? '')}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={helperText}
          placeholder={placeholder}
        />
      )}
      disableClearable={!allowEmpty}
    />
  );
}
