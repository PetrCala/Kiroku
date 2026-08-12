#!/usr/bin/env ruby
# frozen_string_literal: true

# Rewrites fastlane/Snapfile's `languages([...])` block in place so the
# screenshots workflow can capture a single language per run. Throwaway
# change, never committed back.
#
# Why this exists: fastlane's snapshot relaunches the app process between
# languages (new -AppleLanguages launch args), and on this CI runner
# (macos-26, Xcode 26.1.1, an app with an embedded WatchKit companion) that
# relaunch reliably crashes with "Test crashed with signal abrt before
# establishing connection." Language 1 always passes; language 2 always dies
# on the relaunch, and a `number_of_retries` bump just re-runs the whole
# xcodebuild invocation from language 1 and dies at the same spot again. See
# fastlane/Snapfile's languages() comment.
#
# The fix is to never relaunch for a language switch at all: capture one
# language per job/run. The screenshots workflow's `language_subset` input
# drives this trim.
#
# Usage: ruby scripts/trim-snapfile-languages.rb <all|en-only|cs-only>

SNAPFILE = File.expand_path('../fastlane/Snapfile', __dir__)

EN_ONLY = ['en-US'].freeze

CS_ONLY = ['cs-CZ'].freeze

subset = ARGV[0].to_s
case subset
when '', 'all'
  puts "[trim-snapfile-languages] subset='#{subset}': no-op"
  exit 0
when 'en-only'
  languages = EN_ONLY
when 'cs-only'
  languages = CS_ONLY
else
  warn "[trim-snapfile-languages] unknown subset '#{subset}': expected all|en-only|cs-only"
  exit 1
end

abort "Snapfile not found at #{SNAPFILE}" unless File.exist?(SNAPFILE)

src = File.read(SNAPFILE, encoding: 'UTF-8')
replacement = "languages([\n  #{languages.map { |l| "\"#{l}\"" }.join(",\n  ")}\n])"
new_src = src.sub(/languages\(\[.*?\]\)/m, replacement)

if new_src == src
  abort "[trim-snapfile-languages] failed to locate languages([...]) block in Snapfile"
end

File.write(SNAPFILE, new_src)
puts "[trim-snapfile-languages] subset='#{subset}': Snapfile now targets #{languages.join(', ')}"
