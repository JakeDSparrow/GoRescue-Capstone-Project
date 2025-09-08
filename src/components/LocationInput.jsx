import React, { useEffect, useRef, useState } from "react";

const LocationInput = ({ onLocationSelect, disabled, placeholder, value, onChange }) => {
  const autocompleteContainerRef = useRef(null);
  const [isGooglePlacesLoaded, setIsGooglePlacesLoaded] = useState(false);

  useEffect(() => {
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      setIsGooglePlacesLoaded(true);
      const containerElement = autocompleteContainerRef.current;
      if (!containerElement) return;

      let autocompleteElement;
      
      try {
        autocompleteElement = new window.google.maps.places.PlaceAutocompleteElement({
          componentRestrictions: { country: "PH" },
          locationBias: { 
            center: { lat: 15.5786, lng: 120.6736 }, // Victoria, Tarlac center
            radius: 5000 // restrict results within ~5km
          }
        });

        // Listen for a place being selected
        autocompleteElement.addEventListener("placechanged", () => {
          const place = autocompleteElement.getPlace();
          if (place.geometry) {
            onLocationSelect({
              formattedAddress: place.formatted_address,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        });

        // Clear existing content and append the new element
        containerElement.innerHTML = '';
        containerElement.appendChild(autocompleteElement);

        // Pass props to the native input element inside the web component
        const internalInput = autocompleteElement.querySelector('input');
        if (internalInput) {
          internalInput.placeholder = placeholder || "Enter location...";
          internalInput.disabled = disabled;
          
          // This is a key part: sync the input with the parent's form state
          internalInput.value = value;
          internalInput.oninput = (e) => onChange({ target: { name: 'location', value: e.target.value } });
        }
      } catch (error) {
        console.error('Error creating Google Places autocomplete:', error);
        setIsGooglePlacesLoaded(false);
        return;
      }

      // Cleanup function
      return () => {
        if (containerElement && autocompleteElement) {
          try {
            // Check if the element is still a child before removing
            if (containerElement.contains(autocompleteElement)) {
              containerElement.removeChild(autocompleteElement);
            }
          } catch (error) {
            console.warn('Error removing autocomplete element:', error);
            // Fallback: clear the container content
            try {
              containerElement.innerHTML = '';
            } catch (clearError) {
              console.warn('Error clearing container:', clearError);
            }
          }
        }
      };
    } else {
      setIsGooglePlacesLoaded(false);
    }
  }, [onLocationSelect, disabled, placeholder, value, onChange]);

  return (
    <div ref={autocompleteContainerRef} style={{ width: "100%" }}>
      {/* Fallback to a standard input if Google Places API is not loaded */}
      {!isGooglePlacesLoaded && (
        <input 
          type="text"
          id="location"
          name="location"
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder || "Enter location..."}
        />
      )}
    </div>
  );
};

export default LocationInput;