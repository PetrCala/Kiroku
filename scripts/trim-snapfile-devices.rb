#!/usr/bin/env ruby
# frozen_string_literal: true

# Rewrites fastlane/Snapfile's `devices([...])` block in place so the
# screenshots workflow can capture a subset of the device matrix on demand.
# Throwaway change — never committed back.
#
# Usage: ruby scripts/trim-snapfile-devices.rb <all|phone-only|ipad-only>

SNAPFILE = File.expand_path('../fastlane/Snapfile', __dir__)

PHONE_ONLY = ['iPhone 17 Pro Max'].freeze

IPAD_ONLY = ['iPad Pro 13-inch (M5)'].freeze

subset = ARGV[0].to_s
case subset
when '', 'all'
  puts "[trim-snapfile-devices] subset='#{subset}' — no-op"
  exit 0
when 'phone-only'
  devices = PHONE_ONLY
when 'ipad-only'
  devices = IPAD_ONLY
else
  warn "[trim-snapfile-devices] unknown subset '#{subset}' — expected all|phone-only|ipad-only"
  exit 1
end

abort "Snapfile not found at #{SNAPFILE}" unless File.exist?(SNAPFILE)

src = File.read(SNAPFILE, encoding: 'UTF-8')
replacement = "devices([\n  #{devices.map { |d| "\"#{d}\"" }.join(",\n  ")}\n])"
new_src = src.sub(/devices\(\[.*?\]\)/m, replacement)

if new_src == src
  abort "[trim-snapfile-devices] failed to locate devices([...]) block in Snapfile"
end

File.write(SNAPFILE, new_src)
puts "[trim-snapfile-devices] subset='#{subset}' — Snapfile now targets: #{devices.join(', ')}"
