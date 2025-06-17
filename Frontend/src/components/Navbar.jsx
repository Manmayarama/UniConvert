import React from "react";

function Navbar() {
  return (
    <>
      {/* Navbar container: full width, centered, with padding, white background, and shadow */}
      <div className="max-w-screen-2xl mx-auto container px-6 py-3 md:px-40 bg-white shadow-md h-16 fixed top-0 left-0 right-0 z-50">
        <div className="flex justify-between items-center h-full">
          {/* Logo text on the left */}
          <h1 className="text-2xl cursor-pointer font-bold text-indigo-700">
            UniConvert
          </h1>
          {/* Future navigation links or other elements can go here */}
        </div>
      </div>
    </>
  );
}

export default Navbar;
