#!/usr/bin/env ruby
# add_metal_files.rb
# Script para añadir archivos Metal al proyecto Xcode
#
# Uso: ruby ios/add_metal_files.rb

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

# Crear grupo Metal si no existe
mitsuha_group = project.main_group.find_subpath('MitsuhaView', true)

if mitsuha_group.nil?
  puts "❌ Grupo MitsuhaView no encontrado"
  exit 1
end

metal_group = mitsuha_group.find_subpath('Metal', false)

if metal_group.nil?
  metal_group = mitsuha_group.new_group('Metal', 'MitsuhaView/Metal')
  puts "✅ Creado grupo Metal"
else
  puts "✅ Grupo Metal ya existe"
end

# Archivos a añadir
metal_files = [
  {
    name: 'MitsuhaShaders.metal',
    path: 'MitsuhaView/Metal/MitsuhaShaders.metal'
  },
  {
    name: 'MitsuhaMetalRenderer.swift',
    path: 'MitsuhaView/Metal/MitsuhaMetalRenderer.swift'
  },
  {
    name: 'MitsuhaMetalView.swift',
    path: 'MitsuhaView/Metal/MitsuhaMetalView.swift'
  },
  {
    name: 'RNMitsuhaMetalView.h',
    path: 'MitsuhaView/Metal/RNMitsuhaMetalView.h'
  },
  {
    name: 'RNMitsuhaMetalView.m',
    path: 'MitsuhaView/Metal/RNMitsuhaMetalView.m'
  }
]

metal_files.each do |file_info|
  # Verificar si el archivo ya está en el proyecto
  existing_ref = metal_group.files.find { |f| f.display_name == file_info[:name] }
  
  if existing_ref
    puts "⏭️  #{file_info[:name]} ya está en el proyecto"
    next
  end
  
  # Verificar que el archivo existe
  full_path = File.join(__dir__, file_info[:path])
  unless File.exist?(full_path)
    puts "⚠️  Archivo no encontrado: #{full_path}"
    next
  end
  
  # Añadir el archivo al grupo
  file_ref = metal_group.new_file(full_path)
  
  # Determinar el tipo de archivo y añadir al target si es necesario
  if file_info[:name].end_with?('.m', '.mm', '.swift', '.metal')
    target.source_build_phase.add_file_reference(file_ref)
    puts "✅ Añadido #{file_info[:name]} a Sources"
  else
    puts "✅ Añadido #{file_info[:name]} como header"
  end
end

# Guardar el proyecto
project.save
puts "\n🎉 Proyecto guardado exitosamente"
puts "📝 Ahora abre Xcode y compila el proyecto"
