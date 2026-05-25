#!/usr/bin/env ruby
# frozen_string_literal: true

# Generates a `KirokuUITests` UI Testing Bundle target inside
# ios/kiroku.xcodeproj at CI runtime so fastlane `snapshot` has something to
# build/run. The resulting pbxproj diff is intentionally throwaway and must
# NEVER be committed back into the repo:
#
#   * master pins `objectVersion = 54` so that xcodeproj 1.27.0 (and therefore
#     `bundle exec pod install`) can parse the project file. Adding the target
#     in Xcode 26's UI rewrites the project to objectVersion 70 +
#     PBXFileSystemSynchronizedRootGroup, which breaks pod install for every
#     developer (`ArgumentError - Unable to find compatibility version string
#     for object version 70`).
#   * Generating it programmatically with the xcodeproj gem preserves the
#     existing objectVersion and keeps the older PBXGroup-style layout.
#
# Run once before invoking `fastlane ios screenshots`:
#
#     bundle exec ruby scripts/setup-screenshots-test-target.rb
#
# Idempotent — re-running is a no-op if the target already exists.

require 'xcodeproj'
require 'fileutils'
require 'rexml/document'

REPO_ROOT = File.expand_path('..', __dir__)
PROJECT_PATH = File.join(REPO_ROOT, 'ios', 'kiroku.xcodeproj')
UI_TESTS_DIR = File.join(REPO_ROOT, 'ios', 'KirokuUITests')
UI_TESTS_TARGET_NAME = 'KirokuUITests'
HOST_APP_TARGET_NAME = 'kiroku'
SCHEME_PATH = File.join(
  PROJECT_PATH,
  'xcshareddata',
  'xcschemes',
  'Kiroku (production).xcscheme',
)

# --- Helpers ------------------------------------------------------------------

def log(msg)
  puts "[setup-screenshots-test-target] #{msg}"
end

def abort_with(msg)
  warn "[setup-screenshots-test-target] ERROR: #{msg}"
  exit 1
end

# Locate fastlane's bundled SnapshotHelper.swift. The gem ships it at
# `<gem>/snapshot/lib/assets/SnapshotHelper.swift`. We use Bundler to ask
# rubygems where the fastlane gem lives — same lookup the fastlane CLI uses.
def find_snapshot_helper
  spec = Gem::Specification.find_by_name('fastlane')
  candidate = File.join(spec.gem_dir, 'snapshot', 'lib', 'assets', 'SnapshotHelper.swift')
  return candidate if File.exist?(candidate)

  # Some fastlane versions tuck it under a different prefix; do a wider search.
  matches = Dir.glob(File.join(spec.gem_dir, '**', 'SnapshotHelper.swift'))
  return matches.first if matches.any?

  abort_with(
    "could not locate SnapshotHelper.swift in fastlane gem at #{spec.gem_dir}. " \
    "Is the fastlane gem installed via `bundle install`?",
  )
rescue Gem::MissingSpecError
  abort_with('fastlane gem is not installed. Run `bundle install` first.')
end

def copy_snapshot_helper
  FileUtils.mkdir_p(UI_TESTS_DIR)
  dest = File.join(UI_TESTS_DIR, 'SnapshotHelper.swift')
  if File.exist?(dest)
    log "SnapshotHelper.swift already present at #{dest}"
    return dest
  end

  source = find_snapshot_helper
  FileUtils.cp(source, dest)
  log "Copied SnapshotHelper.swift from #{source}"
  dest
end

# Find the host app target named `kiroku` (the one whose product is kiroku.app).
def find_host_target(project)
  target = project.targets.find { |t| t.name == HOST_APP_TARGET_NAME }
  abort_with("could not find host app target '#{HOST_APP_TARGET_NAME}' in project") unless target

  target
end

# Pull a couple of build settings off the host target so the UI test target's
# config matches (deployment target, dev team, etc.).
def host_build_setting(host_target, key, fallback = nil)
  host_target.build_configurations.each do |config|
    value = config.build_settings[key]
    return value if value && !value.to_s.empty?
  end
  fallback
end

# Build settings shared across all configurations of the UI test target.
def base_ui_test_settings(host_target)
  {
    'PRODUCT_NAME'                 => '$(TARGET_NAME)',
    'PRODUCT_BUNDLE_IDENTIFIER'    => 'com.alcohol-tracker.kirokuUITests',
    'SWIFT_VERSION'                => '5.0',
    'TEST_TARGET_NAME'             => HOST_APP_TARGET_NAME,
    'IPHONEOS_DEPLOYMENT_TARGET'   => host_build_setting(host_target, 'IPHONEOS_DEPLOYMENT_TARGET', '15.1'),
    'DEVELOPMENT_TEAM'             => host_build_setting(host_target, 'DEVELOPMENT_TEAM', 'L357YP9W28'),
    'CODE_SIGN_STYLE'              => 'Automatic',
    'TARGETED_DEVICE_FAMILY'       => '1,2',
    'SDKROOT'                      => 'iphoneos',
    'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES' => 'YES',
    'LD_RUNPATH_SEARCH_PATHS'      => [
      '$(inherited)',
      '@executable_path/Frameworks',
      '@loader_path/Frameworks',
    ],
    'CLANG_ENABLE_MODULES'         => 'YES',
    'GENERATE_INFOPLIST_FILE'      => 'YES',
  }
end

# --- Target creation ----------------------------------------------------------

def ensure_ui_tests_group(project, ui_tests_dir_relative)
  existing = project.main_group.find_subpath('KirokuUITests', false)
  return existing if existing

  group = project.main_group.new_group('KirokuUITests', ui_tests_dir_relative)
  group.set_source_tree('<group>')
  group
end

def add_source_file(group, project, abs_path)
  rel_path = File.basename(abs_path)
  file_ref = group.files.find { |f| f.path == rel_path }
  file_ref ||= group.new_reference(rel_path)
  file_ref.last_known_file_type = 'sourcecode.swift'
  file_ref
end

def configure_ui_test_target(project, host_target)
  target = project.targets.find { |t| t.name == UI_TESTS_TARGET_NAME }
  if target
    log "Target '#{UI_TESTS_TARGET_NAME}' already exists; leaving untouched."
    return target
  end

  log "Creating PBXNativeTarget '#{UI_TESTS_TARGET_NAME}' (com.apple.product-type.bundle.ui-testing)"
  target = project.new_target(
    :ui_test_bundle,
    UI_TESTS_TARGET_NAME,
    :ios,
    host_build_setting(host_target, 'IPHONEOS_DEPLOYMENT_TARGET', '15.1'),
  )

  # `new_target` defaults to a minimal config. Layer our shared settings on top.
  base = base_ui_test_settings(host_target)
  target.build_configurations.each do |config|
    config.build_settings.merge!(base)
  end

  # Wire the host application via TargetAttributes (TestTargetID + CreatedOnToolsVersion).
  project.root_object.attributes['TargetAttributes'] ||= {}
  project.root_object.attributes['TargetAttributes'][target.uuid] = {
    'CreatedOnToolsVersion' => '15.2',
    'TestTargetID'          => host_target.uuid,
  }

  # Declare the host as an implicit dependency so xcodebuild builds it first.
  target.add_dependency(host_target)

  target
end

def attach_sources(project, target, source_files)
  group = ensure_ui_tests_group(project, 'KirokuUITests')
  sources_phase = target.source_build_phase

  source_files.each do |abs|
    ref = add_source_file(group, project, abs)
    next if sources_phase.files_references.include?(ref)

    sources_phase.add_file_reference(ref, true)
  end
end

# The legacy `kirokuTests` Obj-C unit-test target ships a latent build-system
# bug: it has both `INFOPLIST_FILE = kirokuTests/Info.plist` set AND an `Info.plist`
# entry in its PBXResourcesBuildPhase that copies `kiroku/Info.plist` (renamed
# to `Info.plist`) into the bundle. Both produce
# `kiroku.app/PlugIns/kirokuTests.xctest/Info.plist`, so xcodebuild on Xcode 26+
# aborts with "Multiple commands produce …/kirokuTests.xctest/Info.plist".
#
# The conflict never surfaced before because the `Kiroku (production)` scheme's
# only testable was kirokuTests (and previous screenshots runs failed earlier
# for unrelated SDK reasons). Once we add a working KirokuUITests testable,
# xcodebuild's stricter dependency planner actually builds kirokuTests and
# trips the collision. Pruning the stale Resources entry is sufficient — the
# INFOPLIST_FILE path remains the canonical producer. The pbxproj diff is
# throwaway, so this only affects the CI screenshots build.
def strip_duplicate_info_plist_resources(project)
  project.targets.each do |target|
    phase = target.respond_to?(:resources_build_phase) ? target.resources_build_phase : nil
    next unless phase

    stale = phase.files.select do |build_file|
      ref = build_file.file_ref
      next false unless ref

      # `name` is the destination filename inside the bundle; `path` is the
      # source on disk. The bug is the destination being `Info.plist` while
      # the target also has its own INFOPLIST_FILE — that's the collision.
      effective_name = ref.name || (ref.path ? File.basename(ref.path) : nil)
      effective_name == 'Info.plist'
    end

    next if stale.empty?

    has_infoplist_setting = target.build_configurations.any? do |config|
      value = config.build_settings['INFOPLIST_FILE']
      value && !value.to_s.empty?
    end
    next unless has_infoplist_setting

    stale.each do |build_file|
      ref = build_file.file_ref
      log(
        "Pruning stale 'Info.plist' Resources entry from target '#{target.name}' " \
        "(source: #{ref.path.inspect}) — collides with INFOPLIST_FILE output.",
      )
      phase.remove_build_file(build_file)
    end
  end
end

# Defensive end-of-script check: walk every target and abort if any of them
# would still produce a duplicate `Info.plist` at build time. Catches future
# regressions where someone re-adds an Info.plist to a target's Resources
# phase, or our pruning loop above misses an edge case.
def assert_no_duplicate_info_plist_outputs(project)
  offenders = project.targets.each_with_object([]) do |target, acc|
    phase = target.respond_to?(:resources_build_phase) ? target.resources_build_phase : nil
    next unless phase

    has_resource_info_plist = phase.files.any? do |build_file|
      ref = build_file.file_ref
      next false unless ref

      effective_name = ref.name || (ref.path ? File.basename(ref.path) : nil)
      effective_name == 'Info.plist'
    end
    next unless has_resource_info_plist

    has_infoplist_setting = target.build_configurations.any? do |config|
      value = config.build_settings['INFOPLIST_FILE']
      value && !value.to_s.empty?
    end
    next unless has_infoplist_setting

    acc << target.name
  end

  return if offenders.empty?

  abort_with(
    "target(s) #{offenders.inspect} have both INFOPLIST_FILE set and an " \
    "'Info.plist' entry in their Resources build phase. xcodebuild will fail " \
    "with 'Multiple commands produce <product>.xctest/Info.plist'. " \
    "strip_duplicate_info_plist_resources should have caught this — please " \
    "investigate why it didn't.",
  )
end

# --- Scheme wiring ------------------------------------------------------------

# Add the UI test target to the shared `Kiroku (production)` scheme's
# TestAction so `xcodebuild test -scheme "Kiroku (production)"` picks it up.
# We edit the XML directly to avoid xcodeproj's scheme writer reformatting
# every line in the file.
def add_testable_to_scheme(target)
  abort_with("scheme not found at #{SCHEME_PATH}") unless File.exist?(SCHEME_PATH)

  doc = REXML::Document.new(File.read(SCHEME_PATH))
  testables = REXML::XPath.first(doc, '//TestAction/Testables')
  abort_with('no <Testables> node in scheme') unless testables

  already_present = REXML::XPath.match(testables, "TestableReference/BuildableReference[@BlueprintName='#{UI_TESTS_TARGET_NAME}']").any?
  if already_present
    log "Scheme already references '#{UI_TESTS_TARGET_NAME}'"
    return
  end

  log "Adding '#{UI_TESTS_TARGET_NAME}' to scheme's TestAction"

  testable = REXML::Element.new('TestableReference')
  testable.add_attribute('skipped', 'NO')

  ref = REXML::Element.new('BuildableReference')
  ref.add_attribute('BuildableIdentifier', 'primary')
  ref.add_attribute('BlueprintIdentifier', target.uuid)
  ref.add_attribute('BuildableName', "#{UI_TESTS_TARGET_NAME}.xctest")
  ref.add_attribute('BlueprintName', UI_TESTS_TARGET_NAME)
  ref.add_attribute('ReferencedContainer', 'container:kiroku.xcodeproj')

  testable.add_element(ref)
  testables.add_element(testable)

  formatter = REXML::Formatters::Pretty.new(3)
  formatter.compact = true
  out = String.new
  formatter.write(doc, out)
  File.write(SCHEME_PATH, out)
end

# --- Main ---------------------------------------------------------------------

def main
  abort_with("project not found at #{PROJECT_PATH}") unless Dir.exist?(PROJECT_PATH)

  copy_snapshot_helper

  project = Xcodeproj::Project.open(PROJECT_PATH)
  original_object_version = project.object_version

  host_target = find_host_target(project)
  target = configure_ui_test_target(project, host_target)

  source_files = [
    File.join(UI_TESTS_DIR, 'ScreenshotTests.swift'),
    File.join(UI_TESTS_DIR, 'SnapshotHelper.swift'),
  ].select { |p| File.exist?(p) }

  attach_sources(project, target, source_files)

  strip_duplicate_info_plist_resources(project)
  assert_no_duplicate_info_plist_outputs(project)

  if project.object_version != original_object_version
    abort_with(
      "objectVersion was bumped from #{original_object_version} to #{project.object_version}; " \
      "refusing to save. This would break `bundle exec pod install` for everyone — " \
      "see commit history for context.",
    )
  end

  project.save

  add_testable_to_scheme(target)

  log "Done. Target '#{UI_TESTS_TARGET_NAME}' is ready for `fastlane ios screenshots`."
end

main if $PROGRAM_NAME == __FILE__
