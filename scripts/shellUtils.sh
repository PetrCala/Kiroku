#!/bin/bash

# Check if GREEN has already been defined
if [ -z "${GREEN+x}" ]; then
  declare -r GREEN=$'\e[1;32m'
fi

# Check if RED has already been defined
if [ -z "${RED+x}" ]; then
  declare -r RED=$'\e[1;31m'
fi

# Check if BLUE has already been defined
if [ -z "${BLUE+x}" ]; then
  declare -r BLUE=$'\e[1;34m'
fi

# Check if TITLE has already been defined
if [ -z "${TITLE+x}" ]; then
  declare -r TITLE=$'\e[1;4;34m'
fi

# Check if RESET has already been defined
if [ -z "${RESET+x}" ]; then
  declare -r RESET=$'\e[0m'
fi

function success {
  echo "🎉 $GREEN$1$RESET"
}

function error {
  echo "💥 $RED$1$RESET"
}

function info {
  echo "$BLUE$1$RESET"
}

function title {
  printf "\n%s%s%s\n" "$TITLE" "$1" "$RESET"
}

# Function to clear the last printed line
clear_last_line() {
  echo -ne "\033[1A\033[K"
}

function assert_equal {
  if [[ "$1" != "$2" ]]; then
    error "Assertion failed: $1 is not equal to $2"
    exit 1
  else
    success "Assertion passed: $1 is equal to $1"
  fi
}

# Usage: join_by_string <delimiter> ...strings
# example: join_by_string ' + ' 'string 1' 'string 2'
# example: join_by_string ',' "${ARRAY_OF_STRINGS[@]}"
function join_by_string {
  local separator="$1"
  shift
  local first="$1"
  shift
  printf "%s" "$first" "${@/#/$separator}"
}

# Usage: get_abs_path <path>
# Will make a path absolute, resolving any relative paths
# example: get_abs_path "./foo/bar"
get_abs_path() {
  local the_path=$1
  local -a path_elements
  IFS='/' read -ra path_elements <<<"$the_path"

  # If the path is already absolute, start with an empty string.
  # We'll prepend the / later when reconstructing the path.
  if [[ "$the_path" = /* ]]; then
    abs_path=""
  else
    abs_path="$(pwd)"
  fi

  # Handle each path element
  for element in "${path_elements[@]}"; do
    if [ "$element" = "." ] || [ -z "$element" ]; then
      continue
    elif [ "$element" = ".." ]; then
      # Remove the last element from abs_path
      abs_path=$(dirname "$abs_path")
    else
      # Append element to the absolute path
      abs_path="${abs_path}/${element}"
    fi
  done

  # Remove any trailing '/'
  while [[ $abs_path == */ ]]; do
    abs_path=${abs_path%/}
  done

  # Special case for root
  [ -z "$abs_path" ] && abs_path="/"

  # Special case to remove any starting '//' when the input path was absolute
  abs_path=${abs_path/#\/\//\/}

  echo "$abs_path"
}

# Function to read lines from standard input into an array using a temporary file.
# This is a bash 3 polyfill for readarray.
# Arguments:
#   $1: Name of the array variable to store the lines
# Usage:
#   read_lines_into_array array_name
read_lines_into_array() {
  local array_name="$1"
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    eval "$array_name+=(\"$line\")"
  done
}

# Function to load .env file variables into the current shell environment
# Example usage:
# load_env /path/to/your/.env
load_env() {
  local env_file="$1"

  # Check if the file path is provided
  if [[ -z "$env_file" ]]; then
    error "Usage: load_env path/to/.env"
    return 1
  fi

  # Check if the file exists and is readable
  if [[ ! -f "$env_file" ]]; then
    error "Error: File not found: $env_file" >&2
    return 1
  fi

  if [[ ! -r "$env_file" ]]; then
    error "Error: File is not readable: $env_file" >&2
    return 1
  fi

  # Export all variables defined in the .env file
  # - 'set -a' marks all variables which are modified or created for export
  # - 'source' reads and executes commands from the .env file in the current shell
  set -a
  # shellcheck source=/dev/null
  source "$env_file"
  set +a

  info "Environment variables loaded from $env_file"
}
