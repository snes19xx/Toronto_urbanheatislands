# Spatial and Socioeconomic Distribution of Toronto’s Urban Heat Islands (Summer 2025)

This repository contains the full workflow, analysis, and visualizations for a geospatial study examining the spatial patterns, drivers, and sociotechnical dynamics of Urban Heat Islands (UHI) across the City of Toronto during Summer 2025.  
The project integrates Landsat 8/9 thermal data, NDVI composites, census socioeconomic indicators, spatial statistics, and geographic modeling.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Objectives](#objectives)
- [Data Sources](#data-sources)
- [Repository Structure](#repository-structure)
- [Environment Setup](#environment-setup)
- [Methodology](#methodology)
  - [1. Thermal Raster Processing](#1-thermal-raster-processing)
  - [2. NDVI Raster Processing](#2-ndvi-raster-processing)
  - [3. Zonal Statistics Extraction](#3-zonal-statistics-extraction)
  - [4. Spatial & Statistical Analysis](#4-spatial--statistical-analysis)
  - [5. Visualization Outputs](#5-visualization-outputs)
- [Key Findings](#key-findings)
- [Limitations](#limitations)
- [How to Reproduce](#how-to-reproduce)
- [Citation](#citation)

---

## Project Overview
Urban heat exposure varies significantly across Toronto due to land cover patterns, proximity to Lake Ontario, vegetation density, and socioeconomic inequality.  
This project performs a full geospatial analysis to:

- Identify **absolute heat hotspots** and **seasonal warming hotspots**  
- Quantify **vegetation buffering effects (NDVI → temperature)**  
- Detect **clusters of extreme heat** using Getis–Ord Gi★ and Moran’s I  
- Explore **inequitable heat burden** across demographic and economic lines  
- Produce **publication-quality maps** for spatial storytelling

---

## Objectives
1. Generate month-by-month thermal mosaics (May–August 2025).
2. Compute an NDVI composite from all cloud-free Landsat 8/9 scenes.
3. Extract census-tract-level zonal statistics for both temperature and NDVI.
4. Run spatial autocorrelation, clustering, and hotspot identification.
5. Conduct socioeconomic analysis of heat exposure.
6. Visualize and export geospatial layers for web mapping.

---

## Data Sources

### **Remote Sensing**
- **Landsat 8/9 Collection 2 Level-2**  
  - Thermal Infrared (Band 10)  
  - Surface Reflectance (Bands 4 & 5 for NDVI)  
- Retrieved via:  
  - Local raster files (thermal bands)  
  - Google Earth Engine (cloud-masked NDVI composite)

### **Vector Data**
- **Toronto Census Tracts (2021)**  
- **City Boundary Shapefile**

### **Socioeconomic Variables**
Extracted from census attributes:
- Income  
- Minority population (%)  
- Renter/Owner ratios  
- Population density  

---
