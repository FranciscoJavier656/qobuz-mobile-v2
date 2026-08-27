#!/usr/bin/env ruby
require 'xcodeproj'

project_path = 'qobuzmobilev2.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the main target
target = project.targets.find { |t| t.name == 'qobuzmobilev2' }

# Find MitsuhaView group or create it
mitsuha_group = project.main_group.find_subpath('MitsuhaView', true)

# Files to add
files_to_add = [
  'VImageColorExtractor.h',
  'VImageColorExtractor.m',
  'RNVImageColorExtractor.h',
  'RNVImageColorExtractor.m'
]

files_to_add.each do |file_name|
  file_path = "../MitsuhaView/#{file_name}"
  
  # Check if file already exists in project
  existing = mitsuha_group.files.find { |f| f.path && f.path.include?(file_name) }
  
  if existing.nil?
    file_ref = mitsuha_group.new_reference(file_path)
    
    # Add .m files to compile sources
    if file_name.end_with?('.m')
      target.source_build_phase.add_file_reference(file_ref)
    end
    
    puts "Added: #{file_name}"
  else
    puts "Already exists: #{file_name}"
  end
end

project.save
puts 'Project saved!'
