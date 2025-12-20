#!/usr/bin/env ruby
# add_metal_frameworks.rb
# Script para añadir frameworks Metal y MetalKit al proyecto Xcode
#
# Uso: ruby ios/add_metal_frameworks.rb

require 'xcodeproj'

project_path = File.join(__dir__, 'qobuzmobilev2.xcodeproj')
project = Xcodeproj::Project.open(project_path)

# Encontrar el target principal
target = project.targets.find { |t| t.name == 'qobuzmobilev2' }

unless target
  puts "❌ Target 'qobuzmobilev2' no encontrado"
  exit 1
end

puts "✅ Encontrado target: #{target.name}"

# Frameworks a añadir
frameworks = ['Metal.framework', 'MetalKit.framework', 'Accelerate.framework']

frameworks.each do |framework_name|
  # Verificar si ya está añadido
  already_linked = target.frameworks_build_phase.files.any? do |file|
    file.display_name == framework_name
  end
  
  if already_linked
    puts "⏭️  #{framework_name} ya está vinculado"
    next
  end
  
  # Añadir el framework
  framework_ref = project.frameworks_group.new_reference(framework_name)
  framework_ref.source_tree = 'SDKROOT'
  framework_ref.set_path("System/Library/Frameworks/#{framework_name}")
  
  target.frameworks_build_phase.add_file_reference(framework_ref)
  puts "✅ Añadido #{framework_name}"
end

# Guardar el proyecto
project.save
puts "\n🎉 Frameworks Metal añadidos exitosamente"
