# IMPORT LIBRARIES
import geopandas as gpd
import pandas as pd
import numpy as np
import statsmodels.api as sm
from os.path import join

# LOAD DATA
# Loading the GeoPackage created in Part 1
gdf = gpd.read_file(join("shapefiles", "Toronto_ct", "Census_full.gpkg"))

print(f"Loaded {len(gdf)} Census Tracts.")

# Define Column Variables
target_var = 'avg_sumr'           # Dependent Variable (Y): Average Summer Temp
ndvi_var   = 'ndvi_mean'          # Independent Variable 1: Vegetation
income_var = 'INCOME'             # Independent Variable 2: Median Income
minority_var = 'minority_percent' # Independent Variable 3: Visible Minority Population %

# Calculate Home Ownership Rate (must be recalculated if not present)
gdf['home_ownership_rate'] = (gdf['OWNER'] / (gdf['OWNER'] + gdf['RENTER'])) * 100
home_var = 'home_ownership_rate'


# PREPARE DATA FOR REGRESSION
# List of all variables needed for the model
cols_to_use = [target_var, ndvi_var, income_var, minority_var, home_var]

# Drop rows with NaN values (error without this step)
print(f"Rows before dropNA: {len(gdf)}")
model_data = gdf[cols_to_use].dropna()
print(f"Rows after dropNA: {len(model_data)}")

# Define Dependent (Y) and Independent (X) variables
Y = model_data[target_var]
X = model_data[[ndvi_var, minority_var, income_var, home_var]]

# Add a constant (intercept) term to the independent variables
X = sm.add_constant(X)

# ---------------------------------------------------------
#  OLS MODEL
# ---------------------------------------------------------
print(f"\n{'-'*60}")
print("ORDINARY LEAST SQUARES (OLS) REGRESSION")
print(f"Dependent Variable (Y): {target_var}")
print(f"Independent Variables (X): NDVI, Minority %, Income, Home Ownership Rate")
print(f"{'-'*60}")

# Instantiate and fit the model
model = sm.OLS(Y, X, missing='drop').fit()

# Print the summary report
print(model.summary())

# COEFFICIENT FOR JS
ndvi_coefficient = model.params.get(ndvi_var, 0)

print(f"\n{'-'*60}")
print(f"EXTRACTED COEFFICIENT (β_NDVI): {ndvi_coefficient:.4f}")
print(f"{'-'*60}")