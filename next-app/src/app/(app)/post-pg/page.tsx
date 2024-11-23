"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  StandaloneSearchBox,
  Marker,
} from "@react-google-maps/api";
import { CircleX, LocateFixed, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { pgFormSchema } from "@/schemas/pgFromSchema";
import { z } from "zod";
import api from "@/lib/axios";

const containerStyle = {
  width: "100%",
  height: "400px",
};

const defaultCenter = {
  lat: 28.6139,
  lng: 77.209,
};

// Types for form data
interface FormData {
  name: string;
  contact: string;
  city: string;
  address: string;
  rentPerMonth: number;
  gender: "MALE" | "FEMALE" | "ANY";
  isDummy: boolean;
  coordinates: string;
  bhk: number;
  capacity: string;
  description: string;
  isAcceptingGuest: boolean;
  images: string[];
}

const AddressForm: React.FC = () => {
  const [center, setCenter] = useState(defaultCenter);
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [isValidCity, setIsValidCity] = useState(true);
  const [cityMessage, setCityMessage] = useState<{
    error: boolean;
    message: string;
  }>({
    error: false,
    message: "",
  });

  const [formData, setFormData] = useState<FormData>({
    name: "",
    contact: "",
    city: "",
    address: "",
    rentPerMonth: 0,
    gender: "MALE",
    isDummy: false,
    coordinates: "",
    bhk: 1,
    capacity: "",
    description: "",
    isAcceptingGuest: true,
    images: [],
  });

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormData, string>>
  >({});

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ["places", "maps"],
  });

  const fetchAddress = useCallback(async () => {
    const { lat, lng } = center;
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      if (data.status === "OK") {
        const locationAddress = data.results[0]?.formatted_address || "";
        const addressComponents = data.results[0]?.address_components || [];
        const cityComponent = addressComponents.find((comp: any) =>
          comp.types.includes("locality")
        )?.long_name;

        setAddress(locationAddress);
        setCity(cityComponent || "Unknown City");
        handleCityCheck(cityComponent || "Unknown City");

        setFormData((prev) => ({
          ...prev,
          city: cityComponent || "Unknown City",
          address: locationAddress,
          coordinates: `${lat},${lng}`,
        }));
      }
    } catch (error) {
      console.error("Error fetching address:", error);
    }
  }, [center]);

  useEffect(() => {
    const debounceTimeout = setTimeout(() => fetchAddress(), 500);
    return () => clearTimeout(debounceTimeout);
  }, [center, fetchAddress]);

  const handleMapDragEnd = () => {
    if (mapRef.current) {
      const newCenter = {
        lat: mapRef.current.getCenter()?.lat() || 0,
        lng: mapRef.current.getCenter()?.lng() || 0,
      };
      setCenter(newCenter);
    }
  };

  const handlePlacesChanged = () => {
    const places = searchBoxRef.current?.getPlaces();
    if (places && places.length > 0) {
      const location = places[0].geometry?.location;
      if (location) {
        const newCenter = {
          lat: location.lat(),
          lng: location.lng(),
        };
        setCenter(newCenter);
      }
    }
  };

  const handleUseCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCenter({ lat: latitude, lng: longitude });
      },
      (error) => toast.error("Error getting location"),
      { enableHighAccuracy: true }
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length < 3 || files.length > 8) {
      toast.error("You must upload between 3 and 8 images");
      return;
    }

    const imagesWithPreview = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...imagesWithPreview],
    }));
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target;
    let finalValue: string | number | boolean = value;

    if (type === "number") {
      finalValue = value === "" ? "" : Number(value);
    } else if (type === "checkbox") {
      finalValue = checked;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }));

    if (name === "city") {
      handleCityCheck(value);
    }
  };

  const handleCityCheck = async (value: string) => {
    try {
      const response = await api.post("/api/pg/check-city", { city: value });
      if (response.data.success) {
        setIsValidCity(true);
        setCityMessage({ error: false, message: response.data.message });
      } else {
        setIsValidCity(false);
        setCityMessage({ error: true, message: response.data.error });
      }
    } catch (error: any) {
      console.error("Error checking city:", error);
      setIsValidCity(false);
      setCityMessage({
        error: true,
        message: error.response?.data?.error || "Error occurred",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.city !== city) {
      toast.error("Selected location doesn't match the form city");
      return;
    }

    try {
      const parsedData = pgFormSchema.parse(formData);
      const response = await api.post("/api/pg/post", parsedData);

      if (response.data.success) {
        toast.success("PG created successfully!");
        setFormData({
          name: "",
          contact: "",
          city: "",
          address: "",
          rentPerMonth: 100,
          gender: "MALE",
          isDummy: false,
          coordinates: "",
          bhk: 1,
          capacity: "",
          description: "",
          isAcceptingGuest: true,
          images: [],
        });
        setFieldErrors({}); // Clear errors on successful submission
      } else {
        toast.error(response.data.error || "Failed to create PG");
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const newFieldErrors: Partial<Record<keyof FormData, string>> = {};
        error.errors.forEach((err) => {
          const fieldName = err.path[0] as keyof FormData;
          newFieldErrors[fieldName] = err.message;
        });
        setFieldErrors(newFieldErrors);
        toast.error("Validation errors occurred. Please check the fields.");
      } else {
        console.error("Error creating PG:", error);
        toast.error("Something went wrong!");
      }
    }
  };

  if (!isLoaded) return <p>Loading Map...</p>;

  return (
    <div className="p-4 max-w-[800px] mx-auto bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-6">Create a New PG</h1>

      <div className="relative mb-4">
        <StandaloneSearchBox
          onLoad={(ref) => (searchBoxRef.current = ref)}
          onPlacesChanged={handlePlacesChanged}
        >
          <div className="relative">
            <input
              type="text"
              placeholder="Search for a location"
              className="w-full p-2 pl-10 border rounded"
            />
            <div className="absolute top-2 left-2 text-slate-400">
              <MapPin />
            </div>
            <div className="absolute top-2 right-2 text-slate-400">
              <Search />
            </div>
          </div>
        </StandaloneSearchBox>
      </div>

      <div className="relative">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={15}
          onLoad={(map) => (mapRef.current = map)}
          onDragEnd={handleMapDragEnd}
        >
          <Marker position={center} marker={markerRef} />
        </GoogleMap>

        <button
          onClick={handleUseCurrentLocation}
          className="absolute bottom-4 right-4 flex items-center px-4 py-2 bg-blue-500 text-white rounded"
        >
          <LocateFixed className="mr-2" /> Use Current Location
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block font-medium">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="PG Name"
              required
              className={`w-full mt-1 p-2 border rounded ${
                fieldErrors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {fieldErrors.name && (
              <p className="text-red-500 text-sm">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="contact" className="block font-medium">
              Contact
            </label>
            <input
              type="text"
              id="contact"
              name="contact"
              value={formData.contact}
              onChange={handleChange}
              placeholder="Contact Number"
              required
              className={`w-full mt-1 p-2 border rounded ${
                fieldErrors.contact ? "border-red-500" : "border-gray-300"
              }`}
            />
            {fieldErrors.contact && (
              <p className="text-red-500 text-sm">{fieldErrors.contact}</p>
            )}
          </div>

          <div>
            <label htmlFor="city" className="block font-medium">
              City
            </label>
            <input
              type="text"
              id="city"
              name="city"
              placeholder="City Name"
              value={formData.city}
              onChange={handleChange}
              required
              disabled
              className={`w-full mt-1 p-2 border rounded ${
                isValidCity ? "border-gray-300" : "border-red-500"
              }`}
            />
            {fieldErrors.city && (
              <p className="text-red-500 text-sm">{fieldErrors.city}</p>
            )}
            {!isValidCity && (
              <p className="text-red-500 text-sm">{cityMessage.message}</p>
            )}
            {isValidCity && (
              <p className="text-green-500 text-sm">{cityMessage.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="bhk" className="block font-medium">
              BHK
            </label>
            <input
              type="number"
              id="bhk"
              name="bhk"
              placeholder="BHK"
              value={formData.bhk}
              onChange={handleChange}
              required
              min="1"
              className={`w-full mt-1 p-2 border rounded ${
                fieldErrors.bhk ? "border-red-500" : "border-gray-300"
              }`}
            />
            {fieldErrors.bhk && (
              <p className="text-red-500 text-sm">{fieldErrors.bhk}</p>
            )}
          </div>

          <div>
            <label htmlFor="capacity" className="block font-medium">
              Total Capacity
            </label>
            <input
              type="number"
              id="capacity"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              required
              min="1"
              placeholder="total capacity"
              className={`w-full mt-1 p-2 border rounded ${
                fieldErrors.capacity ? "border-red-500" : "border-gray-300"
              }`}
            />
            {fieldErrors.capacity && (
              <p className="text-red-500 text-sm">{fieldErrors.capacity}</p>
            )}
          </div>

          <div>
            <label htmlFor="rentPerMonth" className="block font-medium">
              Rent per Month / Per Person
            </label>
            <input
              type="number"
              id="rentPerMonth"
              name="rentPerMonth"
              value={formData.rentPerMonth}
              onChange={handleChange}
              placeholder="rent per month"
              required
              min="0"
              className={`w-full mt-1 p-2 border rounded ${
                fieldErrors.rentPerMonth ? "border-red-500" : "border-gray-300"
              }`}
            />
            {fieldErrors.rentPerMonth && (
              <p className="text-red-500 text-sm">{fieldErrors.rentPerMonth}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="address" className="block font-medium">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            value={address}
            placeholder="Address of PG"
            readOnly
            disabled
            className="w-full mt-1 p-2 border rounded bg-gray-50"
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="description" className="block font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            placeholder="Description of PG"
            value={formData.description}
            onChange={handleChange}
            className={`w-full mt-1 p-2 border rounded ${
              fieldErrors.description ? "border-red-500" : "border-gray-300"
            }`}
            rows={4}
          />
          {fieldErrors.description && (
            <p className="text-red-500 text-sm">{fieldErrors.description}</p>
          )}
        </div>

        <div>
          <label htmlFor="images" className="block font-medium">
            Upload Images
          </label>
          <input
            type="file"
            id="images"
            name="images"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            className="w-full mt-1 p-2 border rounded"
          />
          <div className="grid grid-cols-3 gap-4 mt-4">
            {formData.images.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image.preview}
                  alt={`Preview ${index}`}
                  className="w-full h-32 object-cover rounded shadow"
                />
                <button
                  type="button"
                  className="absolute top-2 left-2 bg-red-500 text-white rounded-full  opacity-0 group-hover:opacity-100 transition"
                  onClick={() => handleRemoveImage(index)}
                >
                  <CircleX />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="gender" className="block font-medium">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
              className="w-full mt-1 p-2 border rounded"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="ANY">Any</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDummy"
              name="isDummy"
              checked={formData.isDummy}
              onChange={handleChange}
              className="rounded"
            />
            <label htmlFor="isDummy" className="font-medium">
              Is Dummy?
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isAcceptingGuest"
              name="isAcceptingGuest"
              checked={formData.isAcceptingGuest}
              onChange={handleChange}
              className="rounded"
            />
            <label htmlFor="isAcceptingGuest" className="font-medium">
              Accepting Guests?
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create PG
        </button>
      </form>
    </div>
  );
};

export default AddressForm;