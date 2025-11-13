# Pincode Data Fetching Options

## What Can Be Fetched from Indian Pincode

From a 6-digit Indian pincode, you can retrieve:

### 1. **State** ✅ (Already Implemented)
- Currently auto-filled using first-digit mapping
- Can be improved with more accurate API

### 2. **City/District**
- District name (e.g., "Bangalore Urban", "Mumbai Suburban")
- City name (e.g., "Bangalore", "Mumbai")
- Useful for address autocomplete

### 3. **Post Office Details**
- Post office name
- Post office type (Head Post Office, Sub Post Office, Branch Post Office)
- Delivery status (Delivery/Non-delivery)

### 4. **Full Address**
- Complete postal address
- Street/locality information
- Can populate address fields automatically

### 5. **Geographic Coordinates**
- Latitude and Longitude
- Useful for mapping, distance calculations, delivery zones

### 6. **Region Information**
- Postal circle (e.g., "Karnataka Circle")
- Sorting district code
- Delivery region

## Available APIs/Services

### Free Options

#### 1. **PostalPinCode.in API** (Free, No Auth)
```
GET https://api.postalpincode.in/pincode/{pincode}
```
**Response:**
```json
{
  "Message": "Number of pincode(s) found:1",
  "Status": "Success",
  "PostOffice": [
    {
      "Name": "Bangalore GPO",
      "Description": null,
      "BranchType": "Head Post Office",
      "DeliveryStatus": "Delivery",
      "Circle": "Karnataka",
      "District": "Bangalore Urban",
      "Division": "Bangalore East",
      "Region": "Bangalore HQ",
      "Block": "Bangalore",
      "State": "Karnataka",
      "Country": "India",
      "Pincode": "560001"
    }
  ]
}
```

**Pros:**
- Free, no authentication required
- Official India Post data
- Returns multiple post offices if pincode covers multiple areas
- Includes State, District, City, Post Office name

**Cons:**
- Rate limits (not documented, but reasonable)
- May have slight delays

#### 2. **India Post API** (Official, Free)
```
GET https://www.indiapost.gov.in/vas/psconnect/pinmaster/pinmaster
```
- Official government API
- Requires registration for production use
- More reliable but slower setup

#### 3. **Geocoding APIs** (Paid/Free Tiers)
- **Google Maps Geocoding API** (Paid, but generous free tier)
- **Mapbox Geocoding API** (Free tier available)
- **OpenCage Geocoding API** (Free tier available)

### Recommended Implementation

For **SetupPage**, we recommend using **PostalPinCode.in API** because:
1. ✅ Free and no authentication needed
2. ✅ Returns State, District, City, Post Office
3. ✅ Fast and reliable
4. ✅ Official India Post data

## Implementation Example

### Enhanced Pincode Lookup Function

```typescript
interface PincodeData {
  state: string
  district: string
  city: string
  postOffice: string
  circle: string
  region: string
}

async function fetchPincodeData(pincode: string): Promise<PincodeData | null> {
  if (!/^\d{6}$/.test(pincode)) return null

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
    const data = await response.json()

    if (data.Status === 'Success' && data.PostOffice && data.PostOffice.length > 0) {
      const office = data.PostOffice[0] // Use first result
      return {
        state: office.State,
        district: office.District,
        city: office.Name, // Post office name often represents city/area
        postOffice: office.Name,
        circle: office.Circle,
        region: office.Region,
      }
    }
  } catch (error) {
    console.error('Pincode lookup failed:', error)
  }

  return null
}
```

### Usage in SetupPage

```typescript
// Auto-fill state, district, city when pincode is complete
useEffect(() => {
  if (formData.pincode.length === 6) {
    fetchPincodeData(formData.pincode).then((data) => {
      if (data) {
        setFormData(prev => ({
          ...prev,
          state: data.state,
          // Could add district/city fields if needed
        }))
      }
    })
  }
}, [formData.pincode])
```

## Additional Fields You Could Add

Based on pincode data, you could enhance the `orgs` table with:

```sql
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS post_office VARCHAR(100);
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
```

## Current vs Enhanced Implementation

### Current (Simple)
- ✅ State auto-filled from first digit
- ✅ Fast, no API calls
- ❌ Less accurate (approximate mapping)
- ❌ No district/city data

### Enhanced (API-based)
- ✅ Accurate state from official data
- ✅ District and city information
- ✅ Post office details
- ✅ Can cache results for performance
- ❌ Requires API call (adds ~200-500ms)
- ❌ Depends on external service

## Recommendation

**For SetupPage (First-time setup):**
- Keep current simple implementation as fallback
- Add API-based lookup as enhancement
- Show loading state during API call
- Cache results in localStorage to avoid repeated calls

**For future enhancements:**
- Add district/city fields if needed for business logic
- Use coordinates for delivery zone calculations
- Store full address for invoice generation

